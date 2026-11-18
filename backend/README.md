# Backend

Java 21 + Spring Boot 4, Maven multi-módulo (o Maven vem pelo wrapper). A infra e a documentação estão na raiz: veja o [README principal](../README.md).

```bash
cp .env.example .env
./mvnw verify                                      # build + testes (unidade e ArchUnit; não precisa de Docker)
./mvnw install -DskipTests                         # instala os módulos, para o spring-boot:run achar estado e contratos
./mvnw -pl leilao-escrita spring-boot:run          # sobe o serviço de escrita (8081)
./mvnw -pl leilao-leitura spring-boot:run          # sobe o serviço de leitura (8082)
./mvnw -pl agendador-leilao spring-boot:run        # sobe o agendador de prazos (8084)
./mvnw -pl leilao-corrida spring-boot:run          # sobe o laboratório "corrida de arquiteturas" (8085)
```

Não use `-am` junto com `spring-boot:run`: ele tenta rodar também os módulos sem `main` e falha. Depois de mudar `estado` ou `contratos`, rode o `install` de novo.

Os serviços expõem `/actuator/health`. Escrita e leitura expõem também `/actuator/metrics` (ex.: `leilao.estado.obter` e `leilao.estado.eventos.lidos`).

Para comparar as configurações do cache (ADR-003): `A` (sem cópia), `B` (só checkpoint) ou `C` (Redis + checkpoint, o padrão). `CACHE_CONFIGURACAO` (`leilao.cache.configuracao`) é só o valor **inicial**: a troca em execução é feita pelas rotas abaixo, sem reiniciar.

## Rotas de administração e apoio

| Serviço | Rota | O que faz |
|---|---|---|
| escrita e leitura | `GET /admin/cache/configuracao` | Configuração ativa: `{"configuracao":"C"}` |
| escrita e leitura | `PUT /admin/cache/configuracao` | Troca A/B/C. Ao ligar o Redis (C), ele é limpo antes; qualquer falha ao limpar o Redis (ex.: fora do ar), responde 503 `REDIS_INDISPONIVEL` e a configuração não muda. Cada serviço troca só a sua: o front chama os dois |
| escrita | `POST /admin/cache/reconstruir` | Apaga Redis e checkpoints, refaz a partir dos eventos e devolve o relatório da comparação |
| leitura | `GET /leiloes/{id}/eventos` | Eventos do leilão, para a linha do tempo da Auditoria |
| leitura | `GET /leiloes/{id}?ateVersao=N` | Estado do leilão na versão N (viagem no tempo) |
| leitura | `GET /infra/saude` | Estado de Postgres, Redis e Kafka; responde sempre 200, com o status de cada um |

**Rotas de administração: sem autenticação, uso local apenas.** `POST /admin/cache/reconstruir` só aceita `Content-Type: application/json`, o que força o preflight de CORS e barra POSTs simples de outros sites, mas não substitui autenticação.

`POST /leiloes/{id}/lances` também devolve `tentativas` (quantas vezes o comando foi tentado por conflito de versão), e as mensagens SSE trazem `evento: {tipo, versao}`. As rotas `/admin` e o actuator aceitam CORS de `http://localhost:5173`.

## Módulos

```
contratos/         eventos, comandos, tópicos e corpos HTTP (o contrato entre as partes)
estado/            EstadoLeilao (aplicar eventos) e como obtê-lo: Redis → checkpoint → eventos posteriores
leilao-escrita/    escrita: domain / application / infrastructure (event store + outbox) / api (8081)
leilao-leitura/    leitura: api (GET + SSE) / consultas (lista, históricos) / notificacoes (8082)
agendador-leilao/  worker que monitora prazos e emite comandos de abertura/fechamento (8084)
ferramentas/       simulador de lances concorrentes e reconstrutor do cache
leilao-corrida/    laboratório: o mesmo leilão em 6 arquiteturas ao mesmo tempo, métricas por SSE (8085)
```

## Ferramentas

```bash
./mvnw -q -pl ferramentas -am package -DskipTests

# reconstrutor: apaga Redis e checkpoints, refaz a partir dos eventos e compara
java -jar ferramentas/target/ferramentas-0.1.0-SNAPSHOT.jar

# simulador: N bots dando lances ao mesmo tempo
./mvnw -q -pl ferramentas dependency:build-classpath -Dmdep.outputFile=target/cp.txt
java -cp ferramentas/target/classes:$(cat ferramentas/target/cp.txt) \
  br.edu.ifsp.leilao.ferramentas.simulador.SimuladorLances <leilaoId> <bots> <lancesPorBot>
```

## Laboratório `leilao-corrida` (8085)

**Só para uso local: sem autenticação e conectado como o superusuário `postgres`.** Corre o mesmo leilão, com a mesma sequência de lances (semente + mulberry32, igual ao `simulacao.ts` do front), ao mesmo tempo em 6 arquiteturas: `crud` (sem controle de concorrência, de propósito), `crud-cache`, `es`, `es-snapshot`, `es-cache` e `es-cqrs`. Não depende de `leilao-escrita`, `leilao-leitura` nem `estado`.

- Desenho: `docs/superpowers/specs/2026-11-19-corrida-arquiteturas-design.md`. Contrato da API e do SSE: `docs/superpowers/specs/2026-11-19-corrida-contrato.md`.
- Rotas: `POST /corrida` (201, 400 `PARAMETRO_INVALIDO`, 409 `CORRIDA_EM_ANDAMENTO`), `GET /corrida/{id}/stream` (SSE `foto` a cada 250 ms e um `fim`), `POST /corrida/{id}/parar` (204) e `GET /corrida/{id}`. CORS para `http://localhost:5173`. Uma corrida por vez.
- Isolamento: cria na subida os schemas `corrida_crud`, `corrida_crud_cache`, `corrida_es`, `corrida_es_snapshot`, `corrida_es_cache` e `corrida_es_cqrs`; usa só as chaves `corrida:<arquitetura>:*` no Redis e o tópico `corrida.cqrs` (3 partições, criado pela aplicação). Nunca toca em `event_store`, `checkpoint`, `read_model` nem em `leilao:*`.
- Cada arquitetura tem o próprio pool de conexões (`CORRIDA_POOL_POR_ARQUITETURA`, padrão 8; as 6 juntas usam 48 conexões) e o próprio pool de threads.
- Variáveis: `CORRIDA_DB_URL` (padrão `jdbc:postgresql://localhost:5433/leilao`), `CORRIDA_DB_USER` e `CORRIDA_DB_PASSWORD` (padrão `postgres`/`postgres`), `REDIS_HOST`/`REDIS_PORT` e `KAFKA_BOOTSTRAP_SERVERS`.
