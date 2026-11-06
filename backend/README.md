# Backend

Java 21 + Spring Boot 4, Maven multi-módulo (o Maven vem pelo wrapper). A infra e a documentação estão na raiz: veja o [README principal](../README.md).

```bash
cp .env.example .env
./mvnw verify                                      # build + testes (contracts e ArchUnit)
./mvnw -pl auction-command -am spring-boot:run     # sobe um serviço
```

Todo serviço expõe `/actuator/health`.

## Módulos

```
contracts/        eventos, comandos e tópicos (o contrato entre escrita e leitura)
es-kit/           EventStore (append com expectedVersion) e OutboxRelay
auction-command/  escrita: domain / application / infrastructure / api   (8081)
auction-query/    leitura: GET + SSE                                       (8082)
projector/        Kafka → Redis + Postgres (read_model)                     (8083)
auction-timer/    emite StartAuction/CloseAuction no horário                (8084)
notification/     avisa lance superado                                      (8085)
replay/           reconstrói projeções
bid-simulator/    robôs dando lances concorrentes
```
