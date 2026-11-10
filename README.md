# Leilão — Event Sourcing + CQRS + EDA com Kafka

Plataforma de leilão online com lances em tempo real. Os comandos geram eventos imutáveis em um event store (PostgreSQL) e são publicados no Kafka via outbox. As projeções (Redis e PostgreSQL) atendem as consultas.

- [docs/PLANO.md](docs/PLANO.md): plano de desenvolvimento (o que cada parte faz, os acordos entre elas e os marcos)
- [docs/DIVISAO.md](docs/DIVISAO.md): quem faz o quê e quando
- [docs/COMMITS.md](docs/COMMITS.md): padrão de commits

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

| Serviço | Endereço | Descrição |
|---|---|---|
| leilao-escrita | http://localhost:8081 | API de escrita, agregado e Event Store / Outbox |
| leilao-leitura | http://localhost:8082 | API de consulta (REST + SSE) e projeções / notificações |
| agendador-leilao | http://localhost:8084 | Worker agendador de abertura e encerramento |
| PostgreSQL | `localhost:5432`, banco `leilao` (usuários em `backend/.env.example`) |
| Redis | `localhost:6379` |
| Kafka | `localhost:9092` (tópicos `auction.events` e `auction.commands.timer`) |
| Kafka UI | http://localhost:8080 |

Para zerar tudo, inclusive os dados: `docker compose -f infra/docker-compose.yml down -v`. O SQL em `infra/sql` só roda com o volume vazio.

## Regras de arquitetura
- Só o `leilao-escrita` escreve no event store, e `event_store.eventos` é append-only (protegido por trigger).
- `leilao-escrita/domain` é Java puro, verificado pelo `ArchitectureTest` (ArchUnit).
- Módulos de leitura não dependem de `leilao-escrita`: só conversam por eventos de `contratos`.
- Mensagens no Kafka usam key = `auctionId`, o que garante a ordem por leilão.
- Os consumidores são idempotentes (guardam a última versão aplicada por leilão).
- `frontend/src/types.ts` espelha `backend/contratos`: mudou um, muda o outro no mesmo PR.
