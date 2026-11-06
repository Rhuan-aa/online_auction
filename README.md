# Leilão — Event Sourcing + CQRS + EDA com Kafka

Plataforma de leilão online com lances em tempo real. Os comandos geram eventos imutáveis em um event store (PostgreSQL) e são publicados no Kafka via outbox. As projeções (Redis e PostgreSQL) atendem as consultas.

A divisão do trabalho está em [docs/DIVISAO.md](docs/DIVISAO.md), e o padrão de commits em [docs/COMMITS.md](docs/COMMITS.md).

```
backend/    Java 21 + Spring Boot 4, Maven multi-módulo  → backend/README.md
frontend/   Vite + React + TypeScript                     → frontend/README.md
infra/      docker-compose (Postgres, Redis, Kafka, Kafka UI) + SQL
docs/       divisão, C4, ADRs
.github/    CI (backend, frontend e infra em jobs separados)
```

## Rodando tudo

Requisitos: JDK 21+, Node 22 e Docker.

```bash
docker compose -f infra/docker-compose.yml up -d   # infra
cd backend  && ./mvnw verify                       # build + testes do back
cd frontend && npm install && npm run dev          # front em http://localhost:5173
```

| Serviço | Endereço |
|---|---|
| auction-command | http://localhost:8081 |
| auction-query | http://localhost:8082 |
| projector | http://localhost:8083 |
| auction-timer | http://localhost:8084 |
| notification | http://localhost:8085 |
| PostgreSQL | `localhost:5432`, banco `leilao` (usuários em `backend/.env.example`) |
| Redis | `localhost:6379` |
| Kafka | `localhost:9092` (tópicos `auction.events` e `auction.commands.timer`) |
| Kafka UI | http://localhost:8080 |

Para zerar tudo, inclusive os dados: `docker compose -f infra/docker-compose.yml down -v`. O SQL em `infra/sql` só roda com o volume vazio.

## Regras de arquitetura
- Só o `auction-command` escreve no event store, e `event_store.events` é append-only (protegido por trigger).
- `auction-command/domain` é Java puro, verificado pelo `ArchitectureTest` (ArchUnit).
- Módulos de leitura não dependem de `auction-command`: só conversam por eventos de `contracts`.
- Mensagens no Kafka usam key = `auctionId`, o que garante a ordem por leilão.
- Os consumidores são idempotentes (guardam a última versão aplicada por leilão).
- `frontend/src/types.ts` espelha `backend/contracts`: mudou um, muda o outro no mesmo PR.
