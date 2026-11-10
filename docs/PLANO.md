# Plano de desenvolvimento

Este documento explica **o que cada parte da divisão faz, por que existe e como se encaixa nas outras**. Quem faz o quê e as datas estão em [DIVISAO.md](DIVISAO.md); o padrão de commits está em [COMMITS.md](COMMITS.md).

---

## 1. A ideia em 1 minuto

Um leilão é uma sequência de fatos: "leilão criado", "lance de R$ 120 do licitante 2", "prazo estendido", "leilão encerrado". Em vez de guardar só o estado atual numa tabela `auctions`, **guardamos os fatos** (eventos) e calculamos o estado a partir deles.

```
           ESCRITA (A e B)                         LEITURA (C e D)                 TELA (D)
 ┌──────────────────────────────┐        ┌────────────────────────────┐
 │ POST /auctions/{id}/bids     │        │ leilao-leitura             │
 │   → carrega eventos          │        │   consome auction.events   │
 │   → Auction decide           │ Kafka  │   → Postgres read_model    │     GET /auctions…
 │   → grava BidPlaced (+outbox)│───────►│   → GET + SSE              │◄──── SSE /stream ──► React
 │   → relay publica no Kafka   │ auction│   → Notificações (log)     │
 └──────────────────────────────┘ .events└────────────────────────────┘
          ▲
          │ StartAuction / CloseAuction
     agendador-leilao (B)
```

Os três conceitos que a banca vai avaliar:

| Conceito | O que significa aqui | Onde mora no código |
|---|---|---|
| **Event Sourcing** | O estado do leilão é derivado dos eventos gravados em `event_store.eventos`, que nunca são alterados | `leilao-escrita/domain`, `infrastructure/eventstore` |
| **CQRS** | Escrita e leitura são modelos e APIs separados: a escrita valida regras, a leitura serve telas | `leilao-escrita` x `leilao-leitura` |
| **EDA com broker** | A escrita publica fatos no Kafka sem saber quem consome; consumidores novos entram sem mexer na escrita | tópico `auction.events` |

**Regra de ouro:** a leitura **nunca** chama a escrita. Ela só reage a eventos.

---

## 2. Os acordos entre as partes (leia antes de codar)

Tudo que cruza a fronteira entre duas pessoas está aqui. Mudou algo daqui? PR separado e aviso no grupo.

### 2.1 Eventos (`backend/contratos`)

| Tipo | Payload | Quem gera |
|---|---|---|
| `AuctionCreated.v1` | `sellerId, title, startingPrice, minIncrement, startsAt, endsAt` | A |
| `AuctionStarted.v1` | `endsAt` | A (a pedido do timer) |
| `BidPlaced.v1` | `bidderId, amount` | A |
| `AuctionExtended.v1` | `newEndsAt` | A (junto com o BidPlaced, quando faltam < 30 s) |
| `AuctionClosed.v1` | `winnerId, winningAmount` (os dois `null` se não houve lances) | A (a pedido do timer) |
| `AuctionCancelled.v1` | `reason` | A |

- Dinheiro é sempre `long` **em centavos** (R$ 12,50 = `1250`). Datas são `Instant`, serializadas como ISO-8601 (`"2026-11-10T18:00:00Z"`).
- `version` é a versão do agregado **depois** do evento: o primeiro evento de um leilão tem `version = 1`.

### 2.2 Mensagem no Kafka

- Tópico `auction.events` (3 partições), **key = auctionId** (string). Isso garante a ordem dos eventos de um mesmo leilão.
- O value é o `EventEnvelope` em JSON:

```json
{
  "globalSeq": 42,
  "aggregateId": "3f1c2b9e-0a4d-4c1e-9b7a-2d5e8f6a1c00",
  "version": 3,
  "type": "BidPlaced.v1",
  "occurredAt": "2026-11-10T17:59:45Z",
  "payload": { "bidderId": "licitante-2", "amount": 12500 },
  "metadata": { "correlationId": "c-81f0", "causationId": "req-77aa", "userId": "licitante-2" }
}
```

- Tópico `auction.commands.timer`, key = auctionId, value = `TimerCommand` (`{"type":"CloseAuction","auctionId":"…","issuedAt":"…"}`).

### 2.3 Consumer groups (cada consumidor lê tudo, no seu ritmo)

| Serviço / Componente | group.id | Tópico |
|---|---|---|
| leilao-escrita | `leilao-escrita` | `auction.commands.timer` |
| agendador-leilao | `agendador-leilao` | `auction.events` |
| leilao-leitura (projeções) | `leilao-leitura-projecoes` | `auction.events` |
| leilao-leitura (notificações) | `notificacoes` | `auction.events` |
| reprocessador | `projecao-replay-<timestamp>` (novo a cada execução) | `auction.events` |

### 2.4 API de comandos (`leilao-escrita`, porta 8081), feita por A e B

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/auctions` | `CreateAuctionRequest` | `201 {"auctionId", "version"}` | `400` validação |
| POST | `/auctions/{id}/bids` | `PlaceBidRequest` | `200 {"version"}` | `404`, `409` (conflito persistiu após as retentativas), `422` regra violada |
| POST | `/auctions/{id}/cancel` | `{"reason"}` | `200 {"version"}` | `404`, `422` |

Formato de erro: `{"error": "BID_TOO_LOW", "message": "Lance mínimo é 13000"}`. Códigos: `AUCTION_NOT_OPEN`, `SELLER_CANNOT_BID`, `BID_TOO_LOW`, `HAS_BIDS`, `INVALID_AUCTION`.

### 2.5 API de consulta (`leilao-leitura`, porta 8082), feita por C

| Rota | Fonte | Resposta |
|---|---|---|
| `GET /auctions?status=OPEN` | Postgres `catalogo_leiloes` | lista de `{auctionId, title, status, currentPrice, endsAt}` |
| `GET /auctions/{id}` | Postgres `catalogo_leiloes` | `{auctionId, title, status, currentPrice, leaderId, endsAt, version}` |
| `GET /auctions/{id}/bids` | `historico_lances` | `[{version, bidderId, amount, placedAt}]` |
| `GET /bidders/{id}/bids` | `atividade_licitantes` | `[{auctionId, lastBidAmount, lastBidAt}]` |
| `GET /auctions/{id}/stream` | SSE (SseEmitter em memória) | SSE: evento `update` com o mesmo JSON de `GET /auctions/{id}` |

Os status no read model são `CREATED`, `OPEN`, `CLOSED` e `CANCELLED`.

### 2.6 Usuários fixos (sem login)

O vendedor é `vendedor-1` e os licitantes são `licitante-1`, `licitante-2` e `licitante-3`. O front tem um seletor "Estou como: …".

---

## 3. As quatro partes

Cada parte tem: **o que é**, **o que entender antes**, **passo a passo** (cada passo é um PR) e **como saber que está pronto**.

### Pessoa A — Escrita: domínio e API de comandos

**O que é.** O coração do sistema. O agregado `Auction` é o **único lugar onde as regras do leilão existem**: lance mínimo, prazo, anti-sniping e quem pode dar lance. Ele recebe um comando, decide e devolve eventos. Ele não grava nada; quem grava é o handler, usando o event store da Pessoa B (em `leilao-escrita/infrastructure`).

**Entender antes.** O que é um agregado (fronteira de consistência), `rehydrate` (reconstruir o estado aplicando eventos em ordem) e a diferença entre *decidir* (valida e gera evento) e *aplicar* (muda o estado a partir do evento).

**Passo a passo**
1. `feat(escrita)`: em `domain/`, `Auction` com `create`, `start`, `placeBid`, `close`, `cancel`, `apply(evento)` e `rehydrate(List<evento>)`. As exceções de domínio correspondem aos códigos da seção 2.4. É **Java puro**, e o `ArchitectureTest` quebra o build se importar Spring ou JDBC.
2. `test(escrita)`: testes JUnit do agregado, sem banco nem Kafka. Cubra: lance abaixo do mínimo, vendedor dando lance, leilão não aberto, lance faltando 10 s (gera `BidPlaced` + `AuctionExtended`), cancelar com lances (falha), encerrar sem lances (`winnerId = null`). O `now` entra como parâmetro, para testar o tempo sem `sleep`.
3. `feat(escrita)`: em `application/`, handlers que fazem carregar (`eventStore.load`) → `rehydrate` → decidir → `eventStore.append(id, expectedVersion, novos)`. Se vier `ConcurrencyException`, **recarregue e tente de novo** (até 3 vezes).
4. `feat(escrita)`: em `api/`, os controllers da seção 2.4, com tradução de exceções para HTTP (`@RestControllerAdvice`) e CORS liberado para `http://localhost:5173`. O `correlationId` vem do header `X-Correlation-Id` ou é gerado.
5. `feat(escrita)`: listener de `auction.commands.timer` chamando os handlers de start/close.

**Pronto quando:** dá para criar um leilão e dar lances via `curl`, os eventos aparecem em `event_store.eventos` com versões 1, 2, 3…, e todos os testes do agregado passam.

**Depende de:** B (EventStore). Enquanto ele não fica pronto, use uma implementação em memória no teste: uma `Map<UUID, List<evento>>` basta.

### Pessoa B — Escrita: event store, outbox, agendador e simulador

**O que é.** A infraestrutura que torna o Event Sourcing **seguro**. São três garantias:
- **Dois lances simultâneos nunca geram dois vencedores.** O `UNIQUE(aggregate_id, version)` faz um dos dois `INSERT` falhar.
- **Nenhum evento é perdido ou publicado sem estar gravado.** Esse é o padrão outbox: o evento e a linha do outbox entram na mesma transação, e um relay publica depois.
- **O leilão abre e fecha sozinho no horário**, pelo agendador.

**Entender antes.** Controle otimista de concorrência (`expectedVersion`), o problema do *dual write* (gravar no banco e publicar no Kafka separadamente pode divergir) e a entrega *at-least-once*.

**Passo a passo**
1. `feat(escrita)`: `PostgresEventStore` em `leilao-escrita/infrastructure` com `load(aggregateId)` (ordenado por `version`) e `append(aggregateId, expectedVersion, eventos)`. O append grava cada evento com `version = expectedVersion + i` e insere no outbox, **na mesma transação**. Uma violação de unicidade (SQLState `23505`) vira `ConcurrencyException`. Use o usuário `command_svc`.
2. `test(escrita)`: teste de integração contra o Postgres do compose. Duas threads fazem append com o mesmo `expectedVersion` e só uma consegue.
3. `feat(escrita)`: `OutboxRelay` com `@Scheduled` a cada ~200 ms. Ele seleciona as linhas pendentes em ordem de `id` (`FOR UPDATE SKIP LOCKED`), monta o `EventEnvelope`, publica com key = aggregateId, espera o ack e marca `published_at`.
4. `feat(agendador)`: consome `auction.events` e guarda `auctionId → startsAt/endsAt` em memória. Ao receber `AuctionExtended`, atualiza o prazo. Um `@Scheduled` a cada 1 s publica `StartAuction`/`CloseAuction` em `auction.commands.timer` para o que venceu.
5. `feat(ferramentas)`: `SimuladorLances` em `ferramentas`. Cria N virtual threads dando lances crescentes no mesmo leilão e, no fim, imprime aceitos, rejeitados por valor e conflitos de versão.

**Pronto quando:** com 50 robôs, o leilão termina com **um único vencedor**, as versões em `events` são contínuas e sem buracos, e todo evento aparece no Kafka UI na mesma ordem.

### Pessoa C — Leitura: projeções, consultas e reprocessador

**O que é.** O lado CQRS de leitura (módulo `leilao-leitura`). Ele transforma o fluxo de eventos em **visões prontas para as telas**: a listagem, o histórico e "meus lances" no Postgres `read_model`. Ele também prova a característica mais impressionante do Event Sourcing: **apagar uma projeção e reconstruí-la idêntica a partir do log**.

**Entender antes.** Consistência eventual (a tela pode atrasar milissegundos), idempotência (o mesmo evento pode chegar duas vezes) e consumer groups e offsets do Kafka.

**Passo a passo**
1. `feat(leitura)`: um `@KafkaListener` em `auction.events` (subpacote `projecoes`) que despacha por `type`:
   - `AuctionCreated`: insere em `catalogo_leiloes`.
   - `Started`/`Closed`/`Cancelled`: atualizam o status.
   - `BidPlaced`: atualiza o preço no catálogo e insere em `historico_lances` e `atividade_licitantes`.
   - `Extended`: atualiza `ends_at`.
   - Todo evento notifica os clientes conectados via SSE (`SseEmitter`).
2. `feat(leitura)`: **idempotência**. Ignore o evento se `version <= last_version` do leilão. `historico_lances` já tem PK `(leilao_id, versao)`, então use `ON CONFLICT DO NOTHING`.
3. `feat(leitura)`: as rotas da seção 2.5 (subpacote `api`) com o usuário `projector_svc`/`query_svc`. O SSE usa `SseEmitter` mantido em memória no serviço de leitura. Libere CORS para o front.
4. `feat(leitura)`: um `HealthIndicator` com o **lag** do consumidor (último offset do tópico menos o offset consumido), aparecendo em `/actuator/health`.
5. `feat(ferramentas)`: `ReprocessadorProjecao` que faz `TRUNCATE` nas tabelas do `read_model`. Depois consome do offset 0 com um group novo, aplicando a mesma lógica de projeção.

**Pronto quando:** derrubar o leilao-leitura, dar lances e subi-lo de novo faz a tela alcançar o estado sozinha; e rodar o reprocessador produz tabelas **idênticas** às de antes.

### Pessoa D — Contrato, front, notificação e entrega

**O que é.** Quem faz o sistema **aparecer** e quem garante que as partes **conversam**. São três frentes:
- Fechar o contrato.
- A tela que a banca vai ver.
- O consumidor de notificações em `leilao-leitura/notificacoes`, que prova a extensibilidade do estilo: um listener novo entra sem mudar uma linha da escrita.

E também a entrega: compose completo, C4, ADRs, slides e roteiro.

**Passo a passo**
1. `feat(contratos)`: revisar com A e C os eventos e as APIs das seções 2.1 a 2.5 **até 08/11**, ajustar `frontend/src/types.ts` e acrescentar um teste de contrato. O teste serializa e desserializa cada payload com Jackson e confere os nomes dos campos do JSON de exemplo.
2. `feat(frontend)`: três telas (Lista, Detalhe com SSE, Criar leilão) e seletor de usuário fixo.
3. `feat(leitura)`: listener em `leilao-leitura/notificacoes` que consome `auction.events` e guarda `auctionId → líder atual`. A cada `BidPlaced` com líder diferente, registra `[notificação] licitante-1 foi superado no leilão X`. No `AuctionClosed`, avisa o vencedor e o vendedor.
4. `build(infra)`: Dockerfile do backend e serviços no `infra/docker-compose.yml`, para que `docker compose up` suba **tudo**.
5. `docs(c4)` e `docs(adr)`: diagramas níveis 1–3 e ADR-001 a 005 (o texto está no plano de arquitetura; troque dependency-cruiser por ArchUnit).
6. `docs`: slides e o roteiro da demo (seção 5), mais o vídeo de reserva.

**Pronto quando:** uma pessoa que nunca viu o projeto clona, roda `docker compose up`, abre o front, cria um leilão, dá lances em duas abas e vê as duas atualizarem ao vivo.

---

## 4. Ordem de integração (marcos)

| Marco | Data | Critério | Quem precisa ter entregado |
|---|---|---|---|
| **M0 – Contrato fechado** | 08/11 | Seções 2.1–2.5 revisadas e `types.ts` atualizado | D, com A e C revisando |
| **M1 – Lance gravado** | 10/11 | `curl` dá lance → linha em `events` → mensagem no Kafka UI | A (passos 1–4), B (1–3) |
| **M2 – Lance na tela** | 13/11 | Lance via front aparece ao vivo em outra aba | C (1–3), D (2) |
| **M3 – Leilão completo** | 14/11 | Abre e fecha sozinho no horário, notificação no log | A (5), B (4), D (3) |
| **M4 – Demo pronta** | 16/11 | Todas as cenas da seção 5 funcionam com `docker compose up` | Todos |

Se um marco atrasar, avise no grupo **no mesmo dia**: os seguintes dependem dele.

---

## 5. Roteiro da demo × quem garante

| # | Cena | O que prova | Responsável |
|---|---|---|---|
| 1 | `docker compose up` sobe tudo | Infra reprodutível | D |
| 2 | Criar leilão e dar lances pela tela | Comando → evento → projeção | A, C, D |
| 3 | Mostrar a tabela `eventos` e o Kafka UI | Event Sourcing e broker | B |
| 4 | `SimuladorLances` com 50 robôs | Concorrência otimista e um único vencedor | B |
| 5 | Derrubar o leilao-leitura, dar lances, subir de novo | Desacoplamento e consistência eventual | C |
| 6 | Fazer TRUNCATE na leitura e rodar o reprocessador | Projeções descartáveis | C |
| 7 | Ver notificações no log sem mexer na escrita | Extensibilidade | D |
| 8 | Violar uma regra de dependência e ver o build quebrar | Restrições verificáveis (ArchUnit) | A |

---

## 6. Definição de pronto (vale para todo PR)

- O CI está verde (`./mvnw verify`, build e lint do front).
- Regra de negócio nova vem com teste.
- Os logs de consumidores e handlers imprimem `correlationId`.
- Nenhum módulo de leitura ganhou dependência de `leilao-escrita` no `pom.xml`.
- Commit e título do PR seguem [COMMITS.md](COMMITS.md).
