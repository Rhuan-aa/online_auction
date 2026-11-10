# Backend

Java 21 + Spring Boot 4, Maven multi-módulo (o Maven vem pelo wrapper). A infra e a documentação estão na raiz: veja o [README principal](../README.md).

```bash
cp .env.example .env
./mvnw verify                                      # build + testes (contratos e ArchUnit)
./mvnw -pl leilao-escrita -am spring-boot:run      # sobe serviço de escrita (8081)
./mvnw -pl leilao-leitura -am spring-boot:run      # sobe serviço de leitura + projeções (8082)
./mvnw -pl agendador-leilao -am spring-boot:run    # sobe o agendador de prazos (8084)
```

Todo serviço expõe `/actuator/health`.

## Módulos

```
contratos/         eventos, comandos e tópicos (o contrato entre escrita e leitura)
leilao-escrita/    escrita: domain / application / infrastructure (event store + outbox) / api (8081)
leilao-leitura/    leitura: consultas (GET + SSE) + projecoes (Kafka → Postgres) + notificacoes (8082)
agendador-leilao/  worker que monitora prazos e emite comandos de abertura/fechamento (8084)
ferramentas/       utilitários CLI: simulador de lances concorrentes e reprocessador de projeções
```
