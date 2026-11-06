# Plano de desenvolvimento

Este documento explica **o que cada parte da divisão faz, por que existe e como se encaixa nas outras**. Quem faz o quê e as datas estão em [DIVISAO.md](DIVISAO.md); o padrão de commits está em [COMMITS.md](COMMITS.md).

---

## 1. A ideia em 1 minuto

Um leilão é uma sequência de fatos: "leilão criado", "lance de R$ 120 do licitante 2", "prazo estendido", "leilão encerrado". Em vez de guardar só o estado atual numa tabela `auctions`, **guardamos os fatos** (eventos) e calculamos o estado a partir deles.

```
           ESCRITA (A e B)                         LEITURA (C)                     TELA (D)
 ┌──────────────────────────────┐        ┌────────────────────────────┐
 │ POST /auctions/{id}/bids     │        │ projector                  │
 │   → carrega eventos          │        │   consome auction.events   │
 │   → Auction decide           │ Kafka  │   → Redis (ao vivo)        │     GET /auctions…
 │   → grava BidPlaced (+outbox)│───────►│   → Postgres read_model    │◄──── SSE /stream ──► React
 │   → relay publica no Kafka   │ auction│ auction-query              │
 └──────────────────────────────┘ .events│   GET + SSE                │
          ▲                              └────────────────────────────┘
          │ StartAuction / CloseAuction          notification (D) também consome
     auction-timer (B)                           auction.events e avisa "lance superado"
```

Os três conceitos que a banca vai avaliar:

| Conceito | O que significa aqui | Onde mora no código |
|---|---|---|
| **Event Sourcing** | O estado do leilão é derivado dos eventos gravados em `event_store.events`, que nunca são alterados | `auction-command/domain`, `es-kit` |
| **CQRS** | Escrita e leitura são modelos e APIs separados: a escrita valida regras, a leitura serve telas | `auction-command` x `projector` + `auction-query` |
| **EDA com broker** | A escrita publica fatos no Kafka sem saber quem consome; consumidores novos entram sem mexer na escrita | tópico `auction.events` |

**Regra de ouro:** a leitura **nunca** chama a escrita. Ela só reage a eventos.

---

## 2. Os acordos entre as partes (leia antes de codar)

Tudo que cruza a fronteira entre duas pessoas está aqui. Mudou algo daqui? PR separado e aviso no grupo.

### 2.1 Eventos (`backend/contracts`)

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

| Serviço | group.id | Tópico |
|---|---|---|
| auction-command | `auction-command` | `auction.commands.timer` |
| auction-timer | `auction-timer` | `auction.events` |
| projector | `projector` | `auction.events` |
| notification | `notification` | `auction.events` |
| replay | `projector-replay-<timestamp>` (novo a cada execução) | `auction.events` |

### 2.4 API de comandos (`auction-command`, porta 8081), feita por A

| Método | Rota | Corpo | Sucesso | Erros |
|---|---|---|---|---|
| POST | `/auctions` | `CreateAuctionRequest` | `201 {"auctionId", "version"}` | `400` validação |
| POST | `/auctions/{id}/bids` | `PlaceBidRequest` | `200 {"version"}` | `404`, `409` (conflito persistiu após as retentativas), `422` regra violada |
| POST | `/auctions/{id}/cancel` | `{"reason"}` | `200 {"version"}` | `404`, `422` |

Formato de erro: `{"error": "BID_TOO_LOW", "message": "Lance mínimo é 13000"}`. Códigos: `AUCTION_NOT_OPEN`, `SELLER_CANNOT_BID`, `BID_TOO_LOW`, `HAS_BIDS`, `INVALID_AUCTION`.

### 2.5 API de consulta (`auction-query`, porta 8082), feita por C

| Rota | Fonte | Resposta |
|---|---|---|
| `GET /auctions?status=OPEN` | Postgres `auction_catalog` | lista de `{auctionId, title, status, currentPrice, endsAt}` |
| `GET /auctions/{id}` | Redis (ao vivo) + catálogo | `{auctionId, title, status, currentPrice, leaderId, endsAt, version}` |
| `GET /auctions/{id}/bids` | `bid_history` | `[{version, bidderId, amount, placedAt}]` |
| `GET /bidders/{id}/bids` | `bidder_activity` | `[{auctionId, lastBidAmount, lastBidAt}]` |
| `GET /auctions/{id}/stream` | Redis Pub/Sub | SSE: evento `update` com o mesmo JSON de `GET /auctions/{id}` |

Os status no read model são `CREATED`, `OPEN`, `CLOSED` e `CANCELLED`.

### 2.6 Redis (combinado entre C e D)

- Hash `auction:{id}` com `status, currentPrice, leaderId, endsAt, version`.
- Canal Pub/Sub `auction:{id}:updates`: o projector publica depois de atualizar o hash, e o auction-query repassa para os clientes SSE. Assim o push sai da leitura, sem tocar a escrita.

### 2.7 Usuários fixos (sem login)

O vendedor é `vendedor-1` e os licitantes são `licitante-1`, `licitante-2` e `licitante-3`. O front tem um seletor "Estou como: …".

---

## 3. As quatro partes

Cada parte tem: **o que é**, **o que entender antes**, **passo a passo** (cada passo é um PR) e **como saber que está pronto**.

### Pessoa A — Escrita: domínio e API de comandos

**O que é.** O coração do sistema. O agregado `Auction` é o **único lugar onde as regras do leilão existem**: lance mínimo, prazo, anti-sniping e quem pode dar lance. Ele recebe um comando, decide e devolve eventos. Ele não grava nada; quem grava é o handler, usando o event store da Pessoa B.

**Entender antes.** O que é um agregado (fronteira de consistência), `rehydrate` (reconstruir o estado aplicando eventos em ordem) e a diferença entre *decidir* (valida e gera evento) e *aplicar* (muda o estado a partir do evento).

**Passo a passo**
1. `feat(command)`: em `domain/`, `Auction` com `create`, `start`, `placeBid`, `close`, `cancel`, `apply(evento)` e `rehydrate(List<evento>)`. As exceções de domínio correspondem aos códigos da seção 2.4. É **Java puro**, e o `ArchitectureTest` quebra o build se importar Spring ou JDBC.
2. `test(command)`: testes JUnit do agregado, sem banco nem Kafka. Cubra: lance abaixo do mínimo, vendedor dando lance, leilão não aberto, lance faltando 10 s (gera `BidPlaced` + `AuctionExtended`), cancelar com lances (falha), encerrar sem lances (`winnerId = null`). O `now` entra como parâmetro, para testar o tempo sem `sleep`.
3. `feat(command)`: em `application/`, handlers que fazem carregar (`eventStore.load`) → `rehydrate` → decidir → `eventStore.append(id, expectedVersion, novos)`. Se vier `ConcurrencyException`, **recarregue e tente de novo** (até 3 vezes).
4. `feat(command)`: em `api/`, os controllers da seção 2.4, com tradução de exceções para HTTP (`@RestControllerAdvice`) e CORS liberado para `http://localhost:5173`. O `correlationId` vem do header `X-Correlation-Id` ou é gerado.
5. `feat(command)`: listener de `auction.commands.timer` chamando os handlers de start/close.

**Pronto quando:** dá para criar um leilão e dar lances via `curl`, os eventos aparecem em `event_store.events` com versões 1, 2, 3…, e todos os testes do agregado passam.

**Depende de:** B (EventStore). Enquanto ele não fica pronto, use uma implementação em memória no teste: uma `Map<UUID, List<evento>>` basta.

### Pessoa B — Escrita: event store, outbox, timer e simulador

**O que é.** A infraestrutura que torna o Event Sourcing **seguro**. São três garantias:
- **Dois lances simultâneos nunca geram dois vencedores.** O `UNIQUE(aggregate_id, version)` faz um dos dois `INSERT` falhar.
- **Nenhum evento é perdido ou publicado sem estar gravado.** Esse é o padrão outbox: o evento e a linha do outbox entram na mesma transação, e um relay publica depois.
- **O leilão abre e fecha sozinho no horário**, pelo timer.

**Entender antes.** Controle otimista de concorrência (`expectedVersion`), o problema do *dual write* (gravar no banco e publicar no Kafka separadamente pode divergir) e a entrega *at-least-once*.

**Passo a passo**
1. `feat(es-kit)`: `PostgresEventStore` com `load(aggregateId)` (ordenado por `version`) e `append(aggregateId, expectedVersion, eventos)`. O append grava cada evento com `version = expectedVersion + i` e insere no outbox, **na mesma transação**. Uma violação de unicidade (SQLState `23505`) vira `ConcurrencyException`. Use o usuário `command_svc`.
2. `test(es-kit)`: teste de integração contra o Postgres do compose. Duas threads fazem append com o mesmo `expectedVersion` e só uma consegue.
3. `feat(es-kit)`: `OutboxRelay` com `@Scheduled` a cada ~200 ms. Ele seleciona as linhas pendentes em ordem de `id` (`FOR UPDATE SKIP LOCKED`), monta o `EventEnvelope`, publica com key = aggregateId, espera o ack e marca `published_at`.
4. `feat(timer)`: consome `auction.events` e guarda `auctionId → startsAt/endsAt` em memória. Ao receber `AuctionExtended`, atualiza o prazo. Um `@Scheduled` a cada 1 s publica `StartAuction`/`CloseAuction` em `auction.commands.timer` para o que venceu. (Perder o mapa ao reiniciar não é problema: ao subir, o timer relê o tópico desde o início.)
5. `feat(simulator)`: `java -jar bid-simulator.jar <auctionId> <robôs> <lances>`. Cria N virtual threads dando lances crescentes no mesmo leilão e, no fim, imprime aceitos, rejeitados por valor e conflitos de versão.

**Pronto quando:** com 50 robôs, o leilão termina com **um único vencedor**, as versões em `events` são contínuas e sem buracos, e todo evento aparece no Kafka UI na mesma ordem.

**Depende de:** nada. É o primeiro a poder começar. **Entrega para:** A (EventStore) e todos (eventos no Kafka).

### Pessoa C — Leitura: projeções, consultas e replay

**O que é.** O lado CQRS de leitura. Ele transforma o fluxo de eventos em **visões prontas para as telas**: o leilão ao vivo no Redis e a listagem, o histórico e "meus lances" no Postgres. Ele também prova a característica mais impressionante do Event Sourcing: **apagar uma projeção e reconstruí-la idêntica a partir do log**.

**Entender antes.** Consistência eventual (a tela pode atrasar milissegundos), idempotência (o mesmo evento pode chegar duas vezes) e consumer groups e offsets do Kafka.

**Passo a passo**
1. `feat(projector)`: um `@KafkaListener` em `auction.events` que despacha por `type`:
   - `AuctionCreated`: insere em `auction_catalog`.
   - `Started`/`Closed`/`Cancelled`: atualizam o status.
   - `BidPlaced`: atualiza o preço no catálogo e insere em `bid_history` e `bidder_activity`.
   - `Extended`: atualiza `ends_at`.
   - Todo evento atualiza o hash Redis e publica em `auction:{id}:updates`.
2. `feat(projector)`: **idempotência**. Ignore o evento se `version <= last_version` do leilão. `bid_history` já tem PK `(auction_id, version)`, então use `ON CONFLICT DO NOTHING`.
3. `feat(query)`: as rotas da seção 2.5 com o usuário `query_svc` (só tem SELECT). O SSE usa `SseEmitter`, assinando o canal Redis do leilão. Libere CORS para o front.
4. `feat(projector)`: um `HealthIndicator` com o **lag** do consumidor (último offset do tópico menos o offset consumido), aparecendo em `/actuator/health`.
5. `feat(replay)`: o comando apaga as chaves `auction:*` do Redis e faz `TRUNCATE` nas tabelas do `read_model`. Depois consome do offset 0 com um group novo, aplicando a mesma lógica do projector (extraia a lógica para uma classe reaproveitável). Opção `--from-db` lê de `event_store.events` em vez do Kafka.

**Pronto quando:** derrubar o projector, dar lances e subi-lo de novo faz a tela alcançar o estado sozinha; e rodar o replay produz um Redis e tabelas **idênticos** aos de antes.

**Como trabalhar sem esperar A e B:** publique o JSON de exemplo da seção 2.2 pela Kafka UI (http://localhost:8080 → Topics → `auction.events` → *Produce message*, key = auctionId).

### Pessoa D — Contrato, front, notificação e entrega

**O que é.** Quem faz o sistema **aparecer** e quem garante que as partes **conversam**. São três frentes:
- Fechar o contrato.
- A tela que a banca vai ver.
- O consumidor `notification`, que prova a extensibilidade do estilo: um serviço novo entra sem mudar uma linha da escrita.

E também a entrega: compose completo, C4, ADRs, slides e roteiro.

**Entender antes.** SSE no navegador (`EventSource`), a regra "a leitura não chama a escrita" e o que cada ADR defende (está no plano de arquitetura).

**Passo a passo**
1. `feat(contracts)`: revisar com A e C os eventos e as APIs das seções 2.1 a 2.5 **até 08/11**, ajustar `frontend/src/types.ts` e acrescentar um teste de contrato. O teste serializa e desserializa cada payload com Jackson e confere os nomes dos campos do JSON de exemplo.
2. `feat(frontend)`: três telas.
   - **Lista** (`GET /auctions`).
   - **Detalhe**: valor atual, líder, contagem regressiva, histórico e `EventSource` em `/auctions/{id}/stream`.
   - **Criar leilão.**
   - Um seletor de usuário fixo. O botão de lance faz POST e, até chegar o SSE, mostra o estado como **"confirmando…"** (consistência eventual visível). Erros `422` aparecem com a mensagem.
   - Enquanto a query não existe, use dados fixos (mock) num arquivo.
3. `feat(notification)`: consome `auction.events` e guarda `auctionId → líder atual` (idempotente por versão). A cada `BidPlaced` com líder diferente, registra `[notificação] licitante-1 foi superado no leilão X`. No `AuctionClosed`, avisa o vencedor e o vendedor. O envio real é um stub (log).
4. `build(infra)`: Dockerfile do backend (um build multi-módulo, um jar por serviço) e serviços no `infra/docker-compose.yml`, para que `docker compose up` suba **tudo**.
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
| 3 | Mostrar a tabela `events` e o Kafka UI | Event Sourcing e broker | B |
| 4 | `bid-simulator` com 50 robôs | Concorrência otimista e um único vencedor | B |
| 5 | Derrubar o projector, dar lances, subir de novo | Desacoplamento e consistência eventual | C |
| 6 | Apagar o Redis e rodar o replay | Projeções descartáveis | C |
| 7 | Ligar o notification sem mexer no comando | Extensibilidade | D |
| 8 | Violar uma regra de dependência e ver o build quebrar | Restrições verificáveis (ArchUnit) | A |

---

## 6. Definição de pronto (vale para todo PR)

- O CI está verde (`./mvnw verify`, build e lint do front).
- Regra de negócio nova vem com teste.
- Os logs de consumidores e handlers imprimem `correlationId`.
- Nenhum módulo de leitura ganhou dependência de `auction-command` no `pom.xml`.
- Commit e título do PR seguem [COMMITS.md](COMMITS.md).
