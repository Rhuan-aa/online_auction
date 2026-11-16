# Plano de desenvolvimento do cache (Pessoa C)

Documento de trabalho da troca do CQRS pelo cache. Alinhado ao ADR-003 e ao PLANO.md (seção 2.7). As linhas marcadas com *(ajustado)* mudaram durante a implementação; o código é a referência final.

## 1. Objetivo
Substituir o CQRS atual (`leilao-leitura` com `read_model` alimentado por Kafka) por **Event Sourcing + cache de estado**. Hoje não há Redis no projeto e todo comando e toda consulta relê todos os eventos do leilão.

Stack: Spring Boot 4.1.2 (Jackson 3), Java 21, JdbcClient, Kafka, Postgres, Maven multi-módulo em `backend/`.

## 2. Decisões tomadas
| Tema | Decisão |
|---|---|
| Escopo | Seguir o ADR-003: migrar e remover o `read_model` |
| Mecanismo | Só `RedisTemplate` (sem Spring Cache) |
| Estado por leilão | Texto com o JSON em `leilao:{id}:estado:v1` (o `v1` é o `SCHEMA_VERSION`), sem TTL, gravação condicional por versão: `GET`, compara, `SET` *(ajustado: comandos básicos no lugar do Lua)* |
| Comandos | Nunca confiam no cache: o banco decide (`versaoEsperada` + `UNIQUE(leilao_id, versao)`); em conflito recarrega da fonte sem cache |
| Consultas | Confiam no Redis. Com versão mínima (`?versaoMinima=`, opcional), se o cache estiver atrás, desce para checkpoint + eventos *(ajustado: nome em português)*. O ouvinte Kafka do SSE pede a versão de cada evento e, com isso, conserta a cópia se a escrita não conseguiu gravá-la |
| Encerramento e vencedor | Sempre reconstroem do event store |
| Redis fora do ar | Captura a exceção e usa timeout curto (100–200 ms). **Sem circuit breaker** |
| Stampede | Single-flight por JVM (a escrita tem uma instância) |
| Listas | Índice `leiloes:abertos` (set de ids, sem TTL; `SADD`/`SREM` logo depois do `SET` do estado) *(ajustado: set simples, a ordem pelo fim é feita em Java)*. `?status=ABERTO` lê o índice (`SMEMBERS`); os outros filtros, "todos" e o índice vazio usam os ids do Event Store. Os estados vêm de uma vez por `MGET` |
| Históricos (lances do leilão e do licitante) | Direto do Event Store, filtrando `LanceRegistrado` *(ajustado: sem sorted set no Redis)*. Sempre corretos e sem estrutura extra |
| Quando gravar no Redis | Logo depois do `anexar`, que já fez o commit (o `@Transactional` está nele) *(ajustado: sem `afterCommit`)*. Exceções capturadas por dentro (não podem fazer o comando parecer falho) |
| Lógica de aplicar eventos | Função pura `aplicar(estado, evento)` e record `EstadoLeilao` no módulo `estado`, reutilizados pelo agregado `Leilao` e pela leitura |
| Métricas | Um endpoint por serviço (escrita 8081 e leitura 8082); o Painel ADM junta os dois |
| Reconstrução | Mantida, por último (primeira a cair se faltar tempo) |

## 3. Fluxos

**Escrita (comando de lance)**
1. Obtém o estado (Redis → checkpoint → eventos posteriores) e guarda `versaoEsperada`.
2. O agregado decide e gera eventos usando `aplicar`.
3. `anexar(id, versaoEsperada, eventos)` grava eventos e outbox na mesma transação.
4. Se o `UNIQUE` rejeitar, recarrega da fonte, sem cache, e tenta de novo (até 3 vezes).
5. Depois do commit, grava o estado novo no Redis com gravação condicional. Se o Redis falhar, só registra no log. Não precisa de `afterCommit`: o `@Transactional` está no `anexar`, então quando ele retorna o commit já aconteceu.
6. Quando a versão passa de um múltiplo de N (padrão 50) ou o leilão termina, grava o checkpoint. Se falhar, só registra no log (o lance já foi aceito).

**Leitura (consulta)**
1. Lê o hash do Redis. Se falhar ou der timeout, vai para o passo 3.
2. Se `versao >= minVersao` (ou sem versão mínima), responde.
3. Senão, lê checkpoint + eventos posteriores, aplicando `aplicar`.
4. Grava no Redis com gravação condicional e responde.

**SSE:** a leitura recebe o evento pelo Kafka e consulta com versão mínima igual à do evento.

**Lista de abertos:** entra no `LeilaoIniciado`, sai no `LeilaoEncerrado` e no `LeilaoCancelado`. A rota lê os ids do índice, busca os estados de uma vez (`MGET`) e monta o resumo.

## 4. Entregas (PRs pequenos)

### PR 1 — Redis + estado na escrita (configs A e C)
- Redis (`redis:7-alpine`) em `infra/docker-compose.yml`, `REDIS_HOST/PORT` em `backend/.env.example` e `spring.data.redis.*` nos YAMLs, com timeout curto.
- Módulo novo `estado` no `backend/pom.xml`: `EstadoLeilao`, `aplicar`, interface de obter estado (para a Pessoa B plugar o checkpoint), `CacheEstadoLeilao` (GET/SET + set de abertos).
- `Leilao` passa a usar `aplicar` (continua Java puro).
- `ServicoLeilao.carregar`: Redis → eventos posteriores (e checkpoint quando existir).
- Gravação no Redis após o commit, pelo método auxiliar de "após commit" chamado no `ServicoLeilao.executar` (e no `criar`), logo depois do `anexar`.
- Single-flight por JVM e chave de configuração para ligar e desligar o cache.
- Ajustar ADR-003 e PLANO §1.1 se algo mudar na prática.

### PR 2 — Lista de abertos e lances por leilão
- Índice `leiloes:abertos` atualizado no mesmo ponto do PR 1.
- Rota de lista lê o índice + `MGET` dos estados.
- Sorted set `leilao:{id}:lances` gravado no mesmo ponto; a rota `GET /leiloes/{id}/lances` lê dele e, se faltar lance (comparando com a versão do estado), desce para os eventos (`criado_em` da tabela) e regrava.

### PR 3 — Migrar a leitura
- `ConsultaController` lê do cache com `?minVersion=`. Trocar só quando o cache estiver estável, para o front não quebrar no meio.
- SSE com versão mínima igual à do evento.
- Depois, remover `ProjecaoLeilao`, `OuvinteProjecao`, `ConsultaLeiloes`, `read_model` (SQL 002 e roles) e `LagProjecaoHealth`.
- `leilao-leitura` permanece (consultas, SSE e `notificacoes` da Pessoa D).

### PR 4 — Métricas e reconstrução
- **Métricas primeiro** (o Painel ADM depende): endpoint por serviço com configuração ativa, eventos lidos, hit ratio e latência; configuração A/B/C nos dois serviços. Remover `ExperimentoController`.
- **Reconstrução por último:** ferramenta em `ferramentas` que calcula o hash do estado, apaga Redis e checkpoints, reconstrói por `versao` (não pelo id global) e compara o hash. Também repovoa a lista de abertos (`SELECT DISTINCT leilao_id`). Substitui `ReprocessadorProjecao`.

### Checkpoint (feito na etapa 6; Pessoa B revisa)
- Tabela `checkpoint.estados (leilao_id PK, versao, schema_version, estado JSONB, gravado_em)` em `infra/sql/004_checkpoint.sql`, com as permissões: `command_svc` grava e apaga, `query_svc` só lê.
- Classe `Checkpoint` no módulo `estado`: `ler` (só no `schema_version` atual), `gravarSeNecessario` e o upsert que só avança (`WHERE versao < EXCLUDED.versao`).
- Regra: grava quando `versao / N` aumenta (pega o caso de pular o múltiplo, ex.: 49 → 51) ou quando o leilão termina.
- `ObterEstado`: sem cópia no Redis, parte do checkpoint; `obterDaFonte` (encerramento e conflito) continua ignorando o checkpoint.
- Gravação síncrona, depois do commit: é um `INSERT` a cada N lances, então não precisa de `@Async`.
- Não foi preciso uma interface: a implementação JDBC é a única, e a Pessoa B revisa a classe.
- Verificado com o log de SQL do Postgres: com o Redis vazio, o lance leu o checkpoint (v200) e só `versao > 200` (1 evento em vez de 201).

## 5. Testes
- Estado em cache == replay completo dos eventos; `aplicar` testado uma vez.
- Gravação condicional: evento antigo não sobrescreve versão maior.
- Dois lances na mesma versão: um é recusado, recarrega e reavalia.
- Versão mínima com cache atrás desce para a fonte; SSE entrega o estado com a versão do evento.
- Regras do índice de abertos (iniciado, prorrogado, encerrado, cancelado).
- Redis parado: o comando conclui dentro do timeout curto. Teste simples com Testcontainers (`GenericContainer("redis:7-alpine")`); prefira pausar o container em vez de parar, porque a porta mapeada pode mudar ao reiniciar.
- Configs A, B e C devolvem o mesmo estado.
- ArchUnit: estado/cache só no módulo `estado`; `leilao-leitura` não depende de `leilao-escrita`; `Leilao` sem Spring.

## 6. Riscos e armadilhas
- **Cache velho sobrescrevendo novo:** leitor lê a versão 5, a escrita grava a 6, o leitor grava a 5 por cima. Comparar a versão (`GET`) antes do `SET` resolve quase sempre *(ajustado: sem Lua)*; a brecha que sobra entre o `GET` e o `SET` só deixa a cópia atrasada, e quem lê completa com os eventos.
- **Gravar antes do commit:** se houver rollback, o Redis fica à frente do banco e, sem TTL, o erro permanece. Gravar só em `afterCommit`.
- **Formato do estado mudou:** versionar o formato (`schema_version`) e descartar entradas antigas.
- **Jackson 3:** `GenericJacksonJsonRedisSerializer` não liga default typing sozinho e a saída pode diferir do Jackson 2; há issue aberta sobre coleções (contra versão antiga, não sei se corrigida). Usar `StringRedisTemplate` + o `JsonMapper` da aplicação com record concreto.
- **Timeout do Lettuce** vale para todos os comandos; não usar comandos bloqueantes.

## 7. Pendências a combinar
- ~~Assinatura da interface de estado com a Pessoa B~~: não foi necessária (ver Checkpoint).
- ~~Redis no compose~~: feito na etapa 4.
- Valor de N do checkpoint: padrão **50**, configurável em `leilao.checkpoint.a-cada-eventos`; confirmar ou ajustar nos experimentos A/B/C.
- Bancos que já existiam precisam aplicar o `004_checkpoint.sql` (comando no README).

## 8. Verificação ponta a ponta
`docker compose up` (Postgres, Kafka, Redis) → subir escrita e leitura → criar leilão e dar lances → conferir `leilao:{id}:estado` no Redis com a versão atual (cada lance lê 0 ou 1 evento) → derrubar o Redis e continuar dando lances → `./mvnw -B verify` verde → Painel ADM nas configs A/B/C → reconstrução com hash idêntico.

## 9. Fora do escopo (cortado)
Circuit breaker, Spring Cache (`@Cacheable`), resumo por leilão como estrutura própria, índice por licitante como estrutura própria, lock distribuído.

## 10. Fontes
- [Spring Data Redis: Redis Cache](https://docs.spring.io/spring-data/redis/reference/redis/redis-cache.html)
- [Turbinando microsserviços com Spring Cache e Redis](https://dev.to/jordihofc/turbinando-seus-microsservicos-com-spring-cache-e-redis-4p1f)
- [Snapshots em Event Sourcing (Kurrent)](https://www.kurrent.io/blog/snapshots-in-event-sourcing/) e [CodeOpinion](https://codeopinion.com/snapshots-in-event-sourcing-for-rehydrating-aggregates/)
- [Redis: atomic updates](https://redis.antirez.com/fundamental/atomic-updates.html) e [CAS em Lua](https://oneuptime.com/blog/post/2026-03-31-redis-implement-atomic-compare-and-swap-in-redis-lua/view)
- [Falhas de Redis no Spring Boot](https://oneuptime.com/blog/post/2026-03-31-redis-spring-boot-failure-handling/view) e [Lettuce FAQ](https://redis.github.io/lettuce/faq)
- [Spring Data Redis: upgrade para Jackson 3](https://docs.spring.io/spring-data-redis/reference/4.0/upgrading.html) e [issue #3234](https://github.com/spring-projects/spring-data-redis/issues/3234)
- [Read-your-writes e rebuild](https://tessl.io/registry/testland/event-sourcing-tests/files/references/rebuild-swap-and-read-your-writes.md)
- [Invalidação de cache distribuída (foojay)](https://foojay.io/today/distributed-cache-invalidation-patterns/)
- [Stampede com mutex](https://kitemetric.com/blogs/preventing-cache-stampede-in-spring-boot-with-mutex-locks)
- [Spring Boot dev services / Testcontainers](https://docs.spring.io/spring-boot/4.0/reference/features/dev-services.html)

As fontes são na maioria blogs e tutoriais; os scripts Lua não foram verificados.
