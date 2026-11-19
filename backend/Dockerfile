FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY . /app
RUN apk add --no-cache dos2unix \
    && dos2unix mvnw \
    && chmod +x mvnw
EXPOSE 8081 8082 8083 8084
CMD ["./mvnw","spring-boot:run","-Dspring-boot.run.fork=true"]