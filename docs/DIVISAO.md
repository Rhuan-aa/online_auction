# Divisão do trabalho — 4 pessoas

> O detalhamento de cada parte (o que é, passo a passo, critérios de pronto e acordos entre as partes) está em [PLANO.md](PLANO.md).

Prazo de entrega: **19/11**. Sistema pronto e integrado em **16/11**, com 17 e 18/11 para ensaiar a demo.

Um único repositório (monorepo):
- **`backend/`**: Java 21 + Spring Boot 4, Maven multi-módulo consolidado (6 módulos em português).
- **`frontend/`**: Vite + React + TypeScript.
- **Na raiz, o que é comum:** `infra/` (docker-compose + SQL), `docs/` e o CI.

O contrato entre todo mundo é o módulo `backend/contratos` (eventos, payloads, tópicos e corpos HTTP). O front tem um espelho dos corpos HTTP em `frontend/src/types.ts`. **Mudou o contrato? Abra um PR só disso, atualize o espelho no front no mesmo PR e avise o grupo antes.**

## Pessoa A — Escrita: domínio e API de comandos
Módulo: `leilao-escrita` (porta 8081)

- `domain`: agregado `Leilao` com as regras puras (criar, iniciar, lance, anti-sniping de 30 s, encerrar, cancelar), decidindo sobre o `EstadoLeilao`. É Java puro, e o `ArchitectureTest` (ArchUnit) quebra o build se importar Spring, JDBC ou Kafka.
- Testes JUnit do agregado: lance baixo, vendedor dando lance, leilão fechado, extensão do prazo, cancelamento com lances.
- `application`: `ServicoLeilao` (obtém o estado pelo cache → decide → grava com `versaoEsperada`; em conflito, relê da fonte e reavalia).
- `api`: `POST /leiloes`, `POST /leiloes/{id}/lances` e `POST /leiloes/{id}/cancelar`, devolvendo a nova versão. Liberar CORS para o front (`localhost:5173`).
- Receber `IniciarLeilao`/`EncerrarLeilao` do agendador (pelo tópico `leilao.comandos-agendador`).

## Pessoa B — Escrita: event store, outbox e agendador
Módulos: `leilao-escrita` (infraestrutura de eventos), `agendador-leilao` (8084), `ferramentas`

- `EventStorePostgres` (em `leilao-escrita/infrastructure`): `anexar(leilaoId, versaoEsperada, eventos)`, gravando eventos e outbox **na mesma transação**. Uma violação do `UNIQUE(leilao_id, versao)` vira `ConflitoDeVersaoException`.
- `PublicadorOutbox` (em `leilao-escrita/infrastructure`): lê o outbox pendente em ordem, publica em `leilao.eventos` com key = id do leilão e marca `publicado_em`.
- `agendador-leilao`: consome `LeilaoCriado`/`Iniciado`/`Prorrogado`, guarda os prazos e publica `IniciarLeilao`/`EncerrarLeilao` no horário.
- Revisar o `Checkpoint` do módulo `estado` (feito junto com o cache).
- `ferramentas`: `SimuladorLances` com N bots (`java.net.http` + virtual threads) dando lances concorrentes no mesmo leilão. Na demo são 50 bots, com um único vencedor.

## Pessoa C — Cache do estado, consultas e reconstrução
Módulos: `estado`, `leilao-leitura` (8082), `ferramentas` (detalhes em [PLANO_CACHE.md](PLANO_CACHE.md))

- `estado`: `EstadoLeilao` (aplicar eventos) e `ObterEstado` (Redis → checkpoint → eventos posteriores), com `CacheEstadoLeilao` (Redis com comandos básicos: GET/SET/MGET e set de abertos), `Checkpoint`, `LeitorEventos`, configurações A/B/C e métricas.
- `leilao-leitura`:
  - `api`: `GET /leiloes`, `GET /leiloes/{id}?versaoMinima=`, `GET /leiloes/{id}/lances`, `GET /licitantes/{id}/lances` e `GET /leiloes/{id}/stream` (SSE com `SseEmitter`, disparado pelo Kafka). Liberar CORS para o front.
  - `consultas`: lista pelo índice de abertos; históricos de lances direto do Event Store.
- `ferramentas`: `ReconstrutorCache`, que apaga Redis e checkpoints, refaz tudo a partir dos eventos e compara com antes.

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
| 07–12/11 | Agregado + API; event store + relay + agendador; cache + consultas; telas | A, B, C, D |
| 12–14/11 | Integração ponta a ponta (lance → Kafka → tela) | Todos |
| 12–15/11 | Notificações, simulador, reconstrutor do cache, serviços no compose | D, B, C |
| 14–17/11 | C4, ADRs, slides | D (todos revisam) |
| 17–18/11 | Ensaio da demo em máquina limpa + gravação | Todos |
| 19/11 | Entrega | — |

## Combinados
- Uma branch por tarefa (`a/agregado`, `c/leitura`…) e PR para `main` com o CI verde.
- Commits em Conventional Commits, sem co-autoria: veja [COMMITS.md](COMMITS.md).
- Dinheiro é sempre **`long` em centavos**; datas em **`Instant`/ISO-8601**.
- Todo evento carrega `correlationId` e `causationId`, e os logs imprimem os dois.
- Nenhum módulo de leitura depende de `leilao-escrita` no `pom.xml`, e nenhum serviço de leitura escreve no event store: a leitura conecta como `query_svc`, que só tem `SELECT` nos eventos e nos checkpoints.
