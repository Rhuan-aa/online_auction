# Backend

Java 21 + Spring Boot 4, Maven multi-módulo (o Maven vem pelo wrapper). A infra e a documentação estão na raiz: veja o [README principal](../README.md).

```bash
cp .env.example .env
./mvnw verify                                      # build + testes (unidade e ArchUnit; não precisa de Docker)
./mvnw install -DskipTests                         # instala os módulos, para o spring-boot:run achar estado e contratos
./mvnw -pl leilao-escrita spring-boot:run          # sobe o serviço de escrita (8081)
./mvnw -pl leilao-leitura spring-boot:run          # sobe o serviço de leitura (8082)
./mvnw -pl agendador-leilao spring-boot:run        # sobe o agendador de prazos (8084)
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
