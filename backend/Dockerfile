# Uma imagem por serviço: o compose passa MODULO (leilao-escrita, leilao-leitura, agendador-leilao
# ou leilao-corrida) e a imagem final leva só o jar daquele serviço.

# Etapa 1: compila todos os módulos (igual para os 4, então o Docker reaproveita o cache).
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
COPY . .
# Tira CRLF do mvnw (checkout no Windows) sem precisar baixar pacote.
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw \
    && ./mvnw -B -q package -DskipTests

# Etapa 2: só o jar do serviço escolhido.
FROM eclipse-temurin:21-jre-alpine
ARG MODULO
WORKDIR /app
COPY --from=build /src/${MODULO}/target/${MODULO}-*-SNAPSHOT.jar app.jar
CMD ["java", "-jar", "/app/app.jar"]
