# Divisão do trabalho — 4 pessoas

> O detalhamento de cada parte (o que é, passo a passo, critérios de pronto e acordos entre as partes) está em [PLANO.md](PLANO.md).

Prazo de entrega: **19/11**. Sistema pronto e integrado em **16/11**, com 17 e 18/11 para ensaiar a demo.

Um único repositório (monorepo):
- **`backend/`**: Java 21 + Spring Boot 4, Maven multi-módulo consolidado (5 módulos em português).
- **`frontend/`**: Vite + React + TypeScript.
- **Na raiz, o que é comum:** `infra/` (docker-compose + SQL), `docs/` e o CI.

O contrato entre todo mundo é o módulo `backend/contratos` (eventos, payloads, tópicos e corpos HTTP). O front tem um espelho dele em `frontend/src/types.ts`. **Mudou o contrato? Abra um PR só disso, atualize o espelho no front no mesmo PR e avise o grupo antes.**

## Pessoa A — Escrita: domínio e API de comandos
Módulo: `leilao-escrita` (porta 8081)

- `domain`: agregado `Auction` com as regras puras (criar, iniciar, lance, anti-sniping de 30 s, encerrar, cancelar) e `rehydrate(events)`. É Java puro, e o `ArchitectureTest` (ArchUnit) quebra o build se importar Spring, JDBC ou Kafka.
- Testes JUnit do agregado: lance baixo, vendedor dando lance, leilão fechado, extensão do prazo, cancelamento com lances.
- `application`: command handlers (carrega → decide → salva com `expectedVersion`; em conflito, recarrega e reavalia).
- `api`: `POST /auctions` e `POST /auctions/{id}/bids`, devolvendo a nova versão. Liberar CORS para o front (`localhost:5173`).
- Receber `StartAuction`/`CloseAuction` do agendador (pelo tópico `auction.commands.timer`).

## Pessoa B — Escrita: event store, outbox e agendador
Módulos: `leilao-escrita` (infraestrutura de eventos), `agendador-leilao` (8084), `ferramentas`

- `PostgresEventStore` (em `leilao-escrita/infrastructure`): `load(aggregateId)` e `append(aggregateId, expectedVersion, events)`, gravando eventos e outbox **na mesma transação**. Uma violação do `UNIQUE(aggregate_id, version)` vira `ConcurrencyException`.
- `OutboxRelay` (em `leilao-escrita/infrastructure`): lê o outbox pendente em ordem, publica em `auction.events` com key = auctionId e marca `published_at`.
- `agendador-leilao`: consome `AuctionCreated`/`Started`/`Extended`, guarda os prazos e publica `StartAuction`/`CloseAuction` no horário.
- `ferramentas`: `SimuladorLances` com N robôs (`java.net.http` + virtual threads) dando lances concorrentes no mesmo leilão. Na demo são 50 robôs, com um único vencedor.

## Pessoa C — Leitura: projeções, consultas e reprocessamento
Módulos: `leilao-leitura` (8082), `ferramentas`

- `leilao-leitura`:
  - `projecoes`: consome `auction.events` e atualiza `LiveAuctionView` (Redis) e `auction_catalog`, `bid_history` e `bidder_activity` (Postgres `read_model`). É **idempotente**: ignora eventos com versão ≤ `last_version`.
  - `api`: `GET /auctions`, `GET /auctions/{id}`, `GET /auctions/{id}/bids`, `GET /bidders/{id}/bids` e `GET /auctions/{id}/stream` (SSE com `SseEmitter`). Liberar CORS para o front.
  - Lag do consumidor exposto no `/actuator/health` (um `HealthIndicator` customizado).
- `ferramentas`: `ReprocessadorProjecao`, que apaga a projeção e reprocessa (novo consumer group a partir do offset 0, ou lendo de `event_store.events`).
- Enquanto a escrita não fica pronta, dá para testar publicando eventos de exemplo pela Kafka UI (http://localhost:8080).

## Pessoa D — Front, notificação e entrega
Pasta `frontend/`, módulo `contratos`, subpacote `notificacoes` em `leilao-leitura`, e pastas `docs/` e `infra/`

- **Até 08/11:** revisar e fechar `contratos` com A e C, e manter o espelho em `types.ts`.
- Front: lista de leilões, detalhe com valor ao vivo (SSE) e botão de lance. Usuários fixos (um seletor "sou o licitante X"), sem login.
- `notificacoes` (em `leilao-leitura`): consumidor que avisa "lance superado" e encerramento (log/stub) com seu próprio consumer group.
- Colocar os serviços no `docker-compose` (Dockerfile único multi-módulo) para o `docker compose up` da demo.
- Diagramas C4 (níveis 1–3) em `docs/c4/` e ADR-001 a 005 em `docs/adr/`. Na ADR, o ArchUnit substitui o dependency-cruiser.
- Slides, roteiro da demo e vídeo de reserva.

## Cronograma

| Quando | O quê | Quem |
|---|---|---|
| 06–08/11 | Infra rodando na máquina de todos; contratos fechado | Todos / D |
| 07–12/11 | Agregado + API; event store + relay + agendador; projeções + consultas; telas | A, B, C, D |
| 12–14/11 | Integração ponta a ponta (lance → Kafka → tela) | Todos |
| 12–15/11 | Notificações, simulador, reprocessador, serviços no compose | D, B, C |
| 14–17/11 | C4, ADRs, slides | D (todos revisam) |
| 17–18/11 | Ensaio da demo em máquina limpa + gravação | Todos |
| 19/11 | Entrega | — |

## Combinados
- Uma branch por tarefa (`a/agregado`, `c/leitura`…) e PR para `main` com o CI verde.
- Commits em Conventional Commits, sem co-autoria: veja [COMMITS.md](COMMITS.md).
- Dinheiro é sempre **`long` em centavos**; datas em **`Instant`/ISO-8601**.
- Todo evento carrega `correlationId` e `causationId`, e os logs imprimem os dois.
- Nenhum módulo de leitura depende de `leilao-escrita` no `pom.xml`, e nenhum serviço de leitura escreve no event store (usuários de banco distintos já garantem isso).
