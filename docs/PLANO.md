# Plano de desenvolvimento

Este documento explica **o que cada parte da divisão faz, por que existe e como se encaixa nas outras**. Quem faz o quê e as datas estão em [DIVISAO.md](DIVISAO.md); o padrão de commits está em [COMMITS.md](COMMITS.md). A troca do CQRS pelo cache está detalhada em [PLANO_CACHE.md](PLANO_CACHE.md).

---

## 1. A ideia em 1 minuto

Um leilão é uma sequência de fatos: "leilão criado", "lance de R$ 120 do licitante 2", "prazo estendido", "leilão encerrado". Em vez de guardar só o estado atual numa tabela `leiloes`, **guardamos os fatos** (eventos) e calculamos o estado a partir deles. Para não reler todos os fatos a cada pedido, o estado calculado fica guardado como **cópia versionada** (Redis e checkpoint), e só os fatos posteriores à cópia são lidos.

```
          ESCRITA (A e B)                     módulo estado (C)                 LEITURA (C e D)        TELA (D)
 ┌───────────────────────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────┐
 │ POST /leiloes/{id}/lances     │   │ ObterEstado                  │   │ leilao-leitura           │
 │   → obtém o estado ───────────┼──►│  1. cópia no Redis           │◄──┼─ GET /leiloes, /{id}     │◄── REST ──┐
 │   → Leilao decide             │   │  2. senão, checkpoint        │   │ GET /leiloes/{id}/lances │           │
 │   → grava LanceRegistrado     │   │  3. + eventos posteriores    │   │ SSE /leiloes/{id}/stream │◄── SSE ──► React
 │     (+outbox, mesma transação)│   │     (Event Store)            │   │ Notificações (log)       │
 │   → atualiza Redis/checkpoint │   └──────────────────────────────┘   └────────────▲─────────────┘
 │   → relay publica no Kafka ───┼──────────── leilao.eventos ────────────────────────┤
 └───────────────▲───────────────┘                                                   │
                 │ IniciarLeilao / EncerrarLeilao                                     │
          agendador-leilao (B) ◄──────────────── leilao.eventos ──────────────────────┘
```

Os três conceitos que a banca vai avaliar:

| Conceito | O que significa aqui | Onde mora no código |
|---|---|---|
| **Event Sourcing** | O estado do leilão é derivado dos eventos gravados em `event_store.eventos`, que nunca são alterados | `leilao-escrita/domain`, `infrastructure`, `estado/EstadoLeilao` |
| **Cache versionado** | O estado calculado é guardado como cópia com versão (Redis + checkpoint); só os eventos posteriores à cópia são lidos. A escrita e a leitura usam o mesmo estado | módulo `estado` (ADR-003) |
| **EDA com broker** | A escrita publica fatos no Kafka sem saber quem consome; consumidores novos entram sem mexer na escrita | tópico `leilao.eventos` |

**Por que não CQRS com banco de leitura?** Num leilão, o valor mostrado não pode estar atrasado: quem vê um preço velho dá um lance sobre um valor que já passou. Um banco de leitura alimentado pelo Kafka tem consistência eventual entre a escrita e a tela. Com o cache, a leitura usa o mesmo estado da escrita, e a cópia carrega a versão para nunca ser confundida com a atual.

**Regra de ouro:** a leitura **nunca** chama a escrita e **nunca** grava no Event Store. As duas obtêm o estado pelo módulo `estado`.

---

## 2. Os acordos entre as partes (leia antes de codar)

Tudo que cruza a fronteira entre duas pessoas está aqui. Mudou algo daqui? PR separado e aviso no grupo.

### 2.1 Eventos (`backend/contratos`)

| Tipo | Dados | Quem gera |
|---|---|---|
| `LeilaoCriado.v1` | `vendedorId, titulo, precoInicial, incrementoMinimo, inicioEm, fimEm` | A |
| `LeilaoIniciado.v1` | `fimEm` | A (a pedido do agendador) |
| `LanceRegistrado.v1` | `licitanteId, valor` | A |
| `LeilaoProrrogado.v1` | `novoFimEm` | A (junto com o lance, quando faltam < 30 s) |
| `LeilaoEncerrado.v1` | `vencedorId, valorVencedor` (os dois `null` se não houve lances) | A (a pedido do agendador) |
| `LeilaoCancelado.v1` | `motivo` | A |

- Dinheiro é sempre `long` **em centavos** (R$ 12,50 = `1250`). Datas são `Instant`, serializadas como ISO-8601 (`"2026-11-10T18:00:00Z"`).
- `versao` é a versão do leilão **depois** do evento: o primeiro evento de um leilão tem `versao = 1`.
- O nome do tipo é o nome do record + `.v1` (`TiposEvento.de` e `TiposEvento.classeDe` convertem nos dois sentidos).

### 2.2 Mensagens no Kafka

- Tópico `leilao.eventos` (3 partições), **key = id do leilão**. Isso garante a ordem dos eventos de um mesmo leilão.
- O value é o `EnvelopeEvento` em JSON:

```json
{
  "id": 42,
  "leilaoId": "3f1c2b9e-0a4d-4c1e-9b7a-2d5e8f6a1c00",
  "versao": 3,
  "tipo": "LanceRegistrado.v1",
  "criadoEm": "2026-11-10T17:59:45Z",
  "dados": { "licitanteId": "licitante-2", "valor": 12500 }
}
```

- Tópico `leilao.comandos-agendador`, key = id do leilão, value = `ComandoAgendador` (`{"tipo":"EncerrarLeilao","leilaoId":"…","emitidoEm":"…"}`; tipos em `ComandoAgendador.INICIAR` e `ENCERRAR`).

### 2.3 Consumer groups (cada consumidor lê tudo, no seu ritmo)

| Serviço / Componente | group.id | Tópico |
|---|---|---|
| leilao-escrita | `leilao-escrita` | `leilao.comandos-agendador` |
| agendador-leilao | `agendador-leilao-<uuid>` (novo a cada início: relê tudo e refaz os prazos) | `leilao.eventos` |
| leilao-leitura (SSE e conserto do cache) | `leilao-leitura-sse-<uuid>` (um por instância, começa do fim) | `leilao.eventos` |
| leilao-leitura (notificações) | `leilao-leitura-notificacoes` | `leilao.eventos` |

### 2.4 API de comandos (`leilao-escrita`, porta 8081), feita por A e B

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/leiloes` | `CriarLeilaoRequest` | `201 {"leilaoId", "versao"}` | `422` dados inválidos |
| POST | `/leiloes/{id}/lances` | `DarLanceRequest` | `200 {"versao"}` | `404`, `409` (conflito persistiu após as retentativas), `422` regra violada |
| POST | `/leiloes/{id}/cancelar` | `{"motivo"}` | `200 {"versao"}` | `404`, `422` |

Formato de erro: `{"erro": "LANCE_ABAIXO_DO_MINIMO", "mensagem": "Lance mínimo é 13000"}`. Códigos: `LEILAO_NAO_ABERTO`, `VENDEDOR_NAO_PODE_DAR_LANCE`, `LANCE_ABAIXO_DO_MINIMO`, `LEILAO_COM_LANCES`, `LEILAO_INVALIDO`, `CONFLITO_DE_VERSAO`, `LEILAO_NAO_ENCONTRADO`.

### 2.5 API de consulta (`leilao-leitura`, porta 8082), feita por C

| Rota | Fonte | Resposta |
|---|---|---|
| `GET /leiloes?status=ABERTO` | índice `leiloes:abertos` (Redis) + estados em cache; os outros status e "todos" pegam os ids no Event Store | `[{leilaoId, titulo, status, precoAtual, fimEm}]`, ordenada pelo fim |
| `GET /leiloes/{id}?versaoMinima=N` | estado pelo `ObterEstado` (confia no Redis se a cópia tiver pelo menos a versão N; `versaoMinima` é opcional) | `{leilaoId, titulo, status, precoAtual, liderId, fimEm, versao}` |
| `GET /leiloes/{id}/lances` | Event Store (eventos `LanceRegistrado`) | `[{versao, licitanteId, valor, criadoEm}]` |
| `GET /licitantes/{id}/lances` | Event Store (último lance do licitante em cada leilão) | `[{leilaoId, ultimoValor, ultimoLanceEm}]` |
| `GET /leiloes/{id}/stream` | SSE (`SseEmitter` em memória), disparado pelos eventos do Kafka | evento `leilao` com o mesmo JSON de `GET /leiloes/{id}` |

Os status são `CRIADO`, `ABERTO`, `ENCERRADO` e `CANCELADO`.

### 2.6 Usuários fixos (sem login)

O vendedor é `vendedor-1` e os licitantes são `licitante-1`, `licitante-2` e `licitante-3`. O front tem um seletor "Estou como: …".

### 2.7 Cache e checkpoint (módulo `estado`, ADR-003)

O estado de um leilão é uma cópia derivada dos eventos, obtida pelo `ObterEstado`:

1. cópia no **Redis**;
2. se não houver, o **checkpoint** no Postgres;
3. se também não houver, o estado inicial (versão 0);
4. aplicam-se só os eventos do Event Store com versão **maior** que a da cópia.

Há três jeitos de pedir o estado:

| Quem | Método | Comportamento |
|---|---|---|
| Comandos (escrita), inclusive a nova tentativa após conflito | `obter` | Sempre completa a cópia com os eventos posteriores: decide sobre o estado mais recente. |
| Encerramento | `obterDaFonte` | Ignora as cópias e relê todos os eventos. |
| Consultas (leitura) | `obterParaConsulta(id, versaoMinima)` | Confia na cópia do Redis se ela tiver pelo menos a versão mínima, sem ir ao banco; se estiver atrás, completa pelo Event Store e conserta a cópia. |

| Cópia | Onde | Quando é gravada | Se falhar |
|---|---|---|---|
| Redis | texto `leilao:{id}:estado:v1` (JSON do estado, com a versão) e o índice `leiloes:abertos` (set de ids + o membro `__completo__`; sem ele, a listagem busca os ids no Event Store e refaz o índice) | A cada evento, logo depois do commit, e quando uma leitura completa uma cópia atrasada. Comandos básicos: `GET` a cópia, compara a versão, `SET` se for maior e `SADD`/`SREM` no índice. | Aviso no log. A próxima leitura completa com os eventos, e o ouvinte do SSE conserta a cópia quando o evento chega pelo Kafka. |
| Checkpoint | tabela `checkpoint.estados` (`infra/sql/004_checkpoint.sql`) | Quando a versão passa de um múltiplo de N (`leilao.checkpoint.a-cada-eventos`, padrão **50**) e quando o leilão termina. O upsert só avança. | Aviso no log; o lance continua aceito. |

- As duas cópias guardam o `EstadoLeilao` em JSON com o `SCHEMA_VERSION`. Uma cópia de outro formato é ignorada.
- Elas são descartáveis: o `ReconstrutorCache` (módulo `ferramentas`) apaga e refaz tudo a partir dos eventos.
- Se o Redis cair, tudo continua funcionando pelo checkpoint e pelos eventos, só mais devagar. O health do Redis fica desligado para não marcar o serviço como fora do ar.
- O checkpoint fica num schema próprio, separado do `event_store`, porque pode ser apagado (ADR-002). O `command_svc` grava e apaga; o `query_svc` só lê.
- **Configurações A/B/C** (`CACHE_CONFIGURACAO` é o valor inicial; `PUT /admin/cache/configuracao` troca em execução, nos dois serviços): `A` = sem cópia, `B` = só checkpoint, `C` = Redis + checkpoint (padrão). Uma cópia desligada se comporta como vazia, então o código segue o mesmo caminho.
- **Métricas** em `/actuator/metrics`, marcadas com a configuração ativa: `leilao.estado.obter` (tempo por caminho) e `leilao.estado.eventos.lidos` (eventos lidos por origem da cópia; taxa de acerto do cache = `count(base=redis) / total`).

---

## 3. As quatro partes

Cada parte tem: **o que é**, **o que entender antes**, **passo a passo** (cada passo é um PR) e **como saber que está pronto**.

### Pessoa A — Escrita: domínio e API de comandos

**O que é.** O coração do sistema. O agregado `Leilao` é o **único lugar onde as regras do leilão existem**: lance mínimo, prazo, anti-sniping e quem pode dar lance. Ele recebe o estado (`EstadoLeilao`), decide e devolve eventos. Ele não grava nada; quem grava é o `ServicoLeilao`, usando o Event Store da Pessoa B.

**Entender antes.** O que é um agregado (fronteira de consistência), a diferença entre *decidir* (valida e gera evento, no `Leilao`) e *aplicar* (muda o estado a partir do evento, no `EstadoLeilao`) e o controle otimista de concorrência (`versaoEsperada`).

**Passo a passo**
1. `feat(escrita)`: em `domain/`, `Leilao` com `criar`, `iniciar`, `darLance`, `encerrar` e `cancelar`, decidindo sobre um `EstadoLeilao`. As exceções de domínio correspondem aos códigos da seção 2.4. É **Java puro**, e o `ArchitectureTest` quebra o build se importar Spring ou JDBC.
2. `test(escrita)`: testes JUnit do agregado, sem banco nem Kafka. Cubra: lance abaixo do mínimo, vendedor dando lance, leilão não aberto, lance faltando 10 s (gera `LanceRegistrado` + `LeilaoProrrogado`), cancelar com lances (falha), encerrar sem lances (`vencedorId = null`). O "agora" entra como parâmetro, para testar o tempo sem `sleep`.
3. `feat(escrita)`: em `application/`, o `ServicoLeilao`: obtém o estado (`ObterEstado.obter`) → o `Leilao` decide → `eventStore.anexar(id, versaoEsperada, novos)` → atualiza as cópias. Se vier `ConflitoDeVersaoException`, **relê da fonte e tenta de novo** (até 3 vezes). O encerramento sempre decide com `obterDaFonte`.
4. `feat(escrita)`: em `api/`, os controllers da seção 2.4, com tradução de exceções para HTTP (`@RestControllerAdvice`) e CORS liberado para `http://localhost:5173`.
5. `feat(escrita)`: listener de `leilao.comandos-agendador` chamando `iniciar` e `encerrar`.

**Pronto quando:** dá para criar um leilão e dar lances via `curl`, os eventos aparecem em `event_store.eventos` com versões 1, 2, 3…, e todos os testes do agregado passam.

**Depende de:** B (Event Store) e C (módulo `estado`).

### Pessoa B — Escrita: event store, outbox, agendador e simulador

**O que é.** A infraestrutura que torna o Event Sourcing **seguro**. São três garantias:
- **Dois lances simultâneos nunca geram dois vencedores.** O `UNIQUE(leilao_id, versao)` faz um dos dois `INSERT` falhar.
- **Nenhum evento é perdido ou publicado sem estar gravado.** Esse é o padrão outbox: o evento e a linha do outbox entram na mesma transação, e um relay publica depois.
- **O leilão abre e fecha sozinho no horário**, pelo agendador.

**Entender antes.** Controle otimista de concorrência (`versaoEsperada`), o problema do *dual write* (gravar no banco e publicar no Kafka separadamente pode divergir) e a entrega *at-least-once*.

**Passo a passo**
1. `feat(escrita)`: `EventStorePostgres` em `leilao-escrita/infrastructure` com `anexar(leilaoId, versaoEsperada, eventos)`. Grava cada evento com `versao = versaoEsperada + i` e insere no outbox, **na mesma transação**. Uma violação de unicidade vira `ConflitoDeVersaoException`. Usa o usuário `command_svc`. (A leitura de eventos fica no `LeitorEventos`, do módulo `estado`.)
2. `test(escrita)`: teste de integração contra o Postgres do compose. Duas threads fazem `anexar` com a mesma `versaoEsperada` e só uma consegue.
3. `feat(escrita)`: `PublicadorOutbox` com `@Scheduled` a cada ~200 ms. Seleciona as linhas pendentes em ordem de `id`, monta o `EnvelopeEvento`, publica com key = id do leilão, espera o ack e marca `publicado_em`.
4. `feat(agendador)`: consome `leilao.eventos` e guarda `leilaoId → inicioEm/fimEm` em memória. Ao receber `LeilaoProrrogado`, atualiza o prazo. Um `@Scheduled` a cada 1 s publica `IniciarLeilao`/`EncerrarLeilao` em `leilao.comandos-agendador` para o que venceu.
5. `feat(ferramentas)`: `SimuladorLances`. Cria N virtual threads dando lances crescentes no mesmo leilão e, no fim, imprime aceitos, recusados por valor e conflitos de versão.
6. Revisar o `Checkpoint` (módulo `estado`), feito pela Pessoa C junto com o cache.

**Pronto quando:** com 50 bots, o leilão termina com **um único vencedor**, as versões em `event_store.eventos` são contínuas e sem buracos, e todo evento aparece no Kafka UI na mesma ordem.

### Pessoa C — Cache do estado: módulo `estado`, consultas e reconstrutor

**O que é.** O caminho pelo qual escrita e leitura obtêm o estado de um leilão sem reler todo o histórico (ADR-003), e as consultas da leitura em cima dele. Também prova a característica mais impressionante do Event Sourcing: **apagar as cópias e reconstruí-las idênticas a partir dos eventos**.

**Entender antes.** Cópia derivada × fonte da verdade (uma cópia velha é incompleta, nunca errada), cache-aside e write-through, gravação condicional (comparar a versão antes do `SET`), cache stampede e o que acontece quando o Redis cai.

**Passo a passo** (detalhado em [PLANO_CACHE.md](PLANO_CACHE.md))
1. `feat(estado)`: módulo `estado` com o `EstadoLeilao` (aplicar eventos) e o teste "continuar de uma cópia = reler tudo".
2. `feat(estado)`: `LeitorEventos` (eventos posteriores a uma versão), `CacheEstadoLeilao` (Redis com comandos básicos: GET/SET/MGET e set de abertos), `Checkpoint` e `ObterEstado` (Redis → checkpoint → eventos, com single-flight).
3. `feat(leitura)`: `GET /leiloes/{id}?versaoMinima=` e o SSE pelo cache, com ouvinte Kafka próprio que conserta a cópia.
4. `feat(leitura)`: lista pelo índice de abertos e históricos de lances pelo Event Store; remoção do `read_model`.
5. `feat(estado)`: configurações A/B/C e métricas em `/actuator/metrics`.
6. `feat(ferramentas)`: `ReconstrutorCache`, que apaga Redis e checkpoints, refaz a partir dos eventos e compara com antes.

**Pronto quando:** com o Redis derrubado o sistema continua correto; o estado obtido pelo cache é igual ao obtido relendo tudo (teste automatizado); e o reconstrutor termina com "Idênticos".

### Pessoa D — Contrato, front, notificação e entrega

**O que é.** Quem faz o sistema **aparecer** e quem garante que as partes **conversam**. São três frentes:
- Fechar o contrato.
- A tela que a banca vai ver.
- O consumidor de notificações em `leilao-leitura/notificacoes`, que prova a extensibilidade do estilo: um listener novo entra sem mudar uma linha da escrita.

E também a entrega: compose completo, C4, ADRs, slides e roteiro.

**Passo a passo**
1. `feat(contratos)`: revisar com A e C os eventos e as APIs das seções 2.1 a 2.5, manter `frontend/src/types.ts` como espelho dos corpos HTTP e acrescentar um teste de contrato.
2. `feat(frontend)`: três telas (Lista, Detalhe com SSE, Criar leilão) e seletor de usuário fixo.
3. `feat(leitura)`: listener em `leilao-leitura/notificacoes` que consome `leilao.eventos` e guarda `leilaoId → líder atual`. A cada `LanceRegistrado` com líder diferente, registra `[notificação] … foi superado`. No `LeilaoEncerrado`, avisa o vencedor e o vendedor.
4. `build(infra)`: Dockerfile do backend e serviços no `infra/docker-compose.yml`, para que `docker compose up` suba **tudo**.
5. `docs(c4)` e `docs(adr)`: diagramas níveis 1–3 e ADRs.
6. `docs`: slides e o roteiro da demo (seção 5), mais o vídeo de reserva.

**Pronto quando:** uma pessoa que nunca viu o projeto clona, roda `docker compose up`, abre o front, cria um leilão, dá lances em duas abas e vê as duas atualizarem ao vivo.

---

## 4. Ordem de integração (marcos)

| Marco | Data | Critério | Quem precisa ter entregado |
|---|---|---|---|
| **M0 – Contrato fechado** | 08/11 | Seções 2.1–2.5 revisadas e `types.ts` atualizado | D, com A e C revisando |
| **M1 – Lance gravado** | 10/11 | `curl` dá lance → linha em `event_store.eventos` → mensagem no Kafka UI | A (passos 1–4), B (1–3) |
| **M2 – Lance na tela** | 13/11 | Lance via front aparece ao vivo em outra aba | C (1–3), D (2) |
| **M3 – Leilão completo** | 14/11 | Abre e fecha sozinho no horário, notificação no log | A (5), B (4), D (3) |
| **M4 – Demo pronta** | 16/11 | Todas as cenas da seção 5 funcionam com `docker compose up` | Todos |

Se um marco atrasar, avise no grupo **no mesmo dia**: os seguintes dependem dele.

---

## 5. Roteiro da demo × quem garante

| # | Cena | O que prova | Responsável |
|---|---|---|---|
| 1 | `docker compose up` sobe tudo | Infra reprodutível | D |
| 2 | Criar leilão e dar lances pela tela, em duas abas | Comando → evento → estado atual nas duas telas | A, C, D |
| 3 | Mostrar a tabela `eventos` e o Kafka UI | Event Sourcing e broker | B |
| 4 | `SimuladorLances` com 50 bots | Concorrência otimista e um único vencedor | B |
| 5 | Mostrar a cópia no Redis (`GET leilao:{id}:estado:v1`) com a mesma versão do Event Store | Cache versionado | C |
| 6 | Derrubar o Redis e continuar dando lances | O cache é otimização: o sistema continua correto, só mais lento | C |
| 7 | Rodar o `ReconstrutorCache` | Cópias descartáveis: refeitas idênticas a partir dos eventos | C |
| 8 | Comparar as configurações A/B/C nas métricas (leilão longo) | Custo de reler o histórico × cache | C, D |
| 9 | Ver notificações no log sem mexer na escrita | Extensibilidade | D |
| 10 | Violar uma regra de dependência e ver o build quebrar | Restrições verificáveis (ArchUnit) | A |

---

## 6. Definição de pronto (vale para todo PR)

- O CI está verde (`./mvnw verify`, build e lint do front).
- Regra de negócio nova vem com teste.
- Os logs de consumidores e handlers imprimem `correlationId`.
- Nenhum módulo de leitura ganhou dependência de `leilao-escrita` no `pom.xml`, e nenhum serviço de leitura grava no Event Store.
- O teste "estado pelo cache = estado relendo todos os eventos" continua passando.
- Commit e título do PR seguem [COMMITS.md](COMMITS.md).
