FROM eclipse-temurin:21-jdk-alpine
WORKDIR /app
COPY . /app
# Use Maven Wrapper (included) to download dependencies and run in dev mode
# Enable Spring DevTools for hot reload (already on classpath)
EXPOSE 8081 8082 8084 8085
CMD ["./mvnw", "spring-boot:run", "-Dspring-boot.run.fork=true"]

