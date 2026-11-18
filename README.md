# Leilão — Event Sourcing + cache versionado + EDA com Kafka

Plataforma de leilão online com lances em tempo real. Os comandos geram eventos imutáveis em um Event Store (PostgreSQL), publicados no Kafka via outbox. O estado de cada leilão é derivado dos eventos e guardado como cópia versionada no Redis e em checkpoints no Postgres: escrita e leitura obtêm o mesmo estado, sem banco de leitura separado (ADR-003).

- [docs/PLANO.md](docs/PLANO.md): plano de desenvolvimento (o que cada parte faz, os acordos entre elas e os marcos)
- [docs/PLANO_CACHE.md](docs/PLANO_CACHE.md): como o CQRS foi trocado pelo cache, decisão por decisão
- [docs/DIVISAO.md](docs/DIVISAO.md): quem faz o quê e quando
- [docs/adr/](docs/adr/) e [docs/c4/](docs/c4/): decisões de arquitetura e diagramas
- [docs/COMMITS.md](docs/COMMITS.md): padrão de commits

```
backend/    Java 21 + Spring Boot 4, Maven multi-módulo  → backend/README.md
frontend/   Vite + React + TypeScript (UI de apresentação) → frontend/README.md
infra/      docker-compose (Postgres, Redis, Kafka, Kafka UI) + SQL
docs/       plano, divisão, C4, ADRs
.github/    CI (backend, frontend e infra em jobs separados)
```

## Rodando tudo

Requisitos: JDK 21+, Node 22 e Docker.

```bash
docker compose -f infra/docker-compose.yml up -d   # infra
cd backend  && ./mvnw verify                       # build + testes do back (os serviços: backend/README.md)
cd frontend && npm install && npm run dev          # front em http://localhost:5173
```

| Serviço | Endereço | Descrição |
|---|---|---|
| leilao-escrita | http://localhost:8081 | API de comandos: agregado, Event Store, outbox, atualização das cópias do estado. Também `GET`/`PUT /admin/cache/configuracao` (troca A/B/C sem reiniciar) e `POST /admin/cache/reconstruir` |
| leilao-leitura | http://localhost:8082 | API de consulta (REST + SSE) pelo cache; notificações. Também `GET /leiloes/{id}/eventos`, `GET /leiloes/{id}?ateVersao=N` (auditoria), `GET /infra/saude` e `GET`/`PUT /admin/cache/configuracao` |
| agendador-leilao | http://localhost:8084 | Worker que abre e encerra os leilões no horário (`/actuator/health` com CORS para o front) |
| leilao-corrida | http://localhost:8085 | Laboratório "corrida de arquiteturas": o mesmo leilão em 6 arquiteturas ao mesmo tempo, com métricas ao vivo por SSE. **Só local**: sem autenticação e usa o superusuário `postgres` (schemas próprios `corrida_*`). Veja `backend/README.md` |
| PostgreSQL | `localhost:5432`, banco `leilao` | Event Store (`event_store`) e checkpoints (`checkpoint`); usuários em `backend/.env.example` |
| Redis | `localhost:6379` | Cópia do estado e índice de abertos; descartável, sem volume |
| Kafka | `localhost:9092` | Tópicos `leilao.eventos` e `leilao.comandos-agendador` |
| Kafka UI | http://localhost:8080 | |

Para zerar tudo, inclusive os dados: `docker compose -f infra/docker-compose.yml down -v`. O SQL em `infra/sql` só roda com o volume vazio.

### Atualizando um banco que já existia

A troca do CQRS pelo cache mudou o SQL. O caminho simples é recriar o banco (`down -v` e `up -d`). Para manter os dados, rode no Postgres (`docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -d leilao`):

```bash
# 1) tabela de checkpoints e permissões
docker compose -f infra/docker-compose.yml exec -T postgres psql -U postgres -d leilao < infra/sql/004_checkpoint.sql
```

```sql
-- 2) a leitura passa a ler os eventos (query_svc) e ganha o índice de "lances do licitante"
GRANT USAGE ON SCHEMA event_store TO query_svc;
GRANT SELECT ON event_store.eventos TO query_svc;
CREATE INDEX eventos_lances_por_licitante ON event_store.eventos ((dados->>'licitanteId'))
  WHERE tipo = 'LanceRegistrado.v1';
-- 3) opcional: o banco de leitura antigo ficou sem uso
DROP SCHEMA read_model CASCADE;
```

## Regras de arquitetura
- Só o `leilao-escrita` grava no Event Store, e `event_store.eventos` é append-only (protegido por trigger e por permissão).
- O Event Store é a única fonte da verdade. Redis e checkpoint são cópias versionadas: podem ser apagados e refeitos (`ferramentas`).
- Quem garante que dois lances não vencem juntos é o banco (`versaoEsperada` + `UNIQUE(leilao_id, versao)`), nunca o cache. O encerramento sempre relê os eventos.
- Se o Redis cair, o sistema continua correto, só mais lento.
- `leilao-escrita/domain` e o `EstadoLeilao` são Java puro, verificados pelos `ArchitectureTest` (ArchUnit).
- A leitura não depende de `leilao-escrita`: compartilha só `contratos` e `estado`, e conecta como `query_svc` (só leitura).
- Mensagens no Kafka usam key = id do leilão, o que garante a ordem por leilão. Os consumidores são idempotentes.
- `frontend/src/types.ts` espelha os corpos HTTP de `backend/contratos`: mudou um, muda o outro no mesmo PR.
