package br.edu.ifsp.leilao.leitura.consultas;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.AdminClientConfig;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Component;

/**
 * Checagem de Postgres, Redis e Kafka para o painel "Arquitetura" (GET /infra/saude).
 * Cada checagem tem timeout de 1 s e nunca lança: falha vira DOWN com uma mensagem curta.
 * Separada do /actuator/health de propósito: o Redis é só cache e não pode derrubar o serviço (ADR-003).
 */
@Component
public class ChecagemInfra {

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Componente(String status, long ms, String erro) {}

    private static final long TIMEOUT_MS = 1000;

    private final Map<String, Callable<?>> checagens;
    private final long timeoutMs;
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "checagem-infra");
        t.setDaemon(true);
        return t;
    });

    @Autowired
    public ChecagemInfra(JdbcClient jdbc, StringRedisTemplate redis, KafkaAdmin kafkaAdmin) {
        this(reais(jdbc, redis, kafkaAdmin), TIMEOUT_MS);
    }

    ChecagemInfra(Map<String, Callable<?>> checagens) {
        this(checagens, TIMEOUT_MS);
    }

    ChecagemInfra(Map<String, Callable<?>> checagens, long timeoutMs) {
        this.checagens = checagens;
        this.timeoutMs = timeoutMs;
    }

    private static Map<String, Callable<?>> reais(JdbcClient jdbc, StringRedisTemplate redis, KafkaAdmin kafkaAdmin) {
        Map<String, Callable<?>> m = new LinkedHashMap<>();
        m.put("postgres", () -> jdbc.sql("SELECT 1").query(Integer.class).single());
        m.put("redis", () -> redis.execute((org.springframework.data.redis.core.RedisCallback<String>) c -> c.ping()));
        m.put("kafka", () -> {
            Map<String, Object> cfg = new LinkedHashMap<>(kafkaAdmin.getConfigurationProperties());
            cfg.put(AdminClientConfig.REQUEST_TIMEOUT_MS_CONFIG, 1000);
            cfg.put(AdminClientConfig.DEFAULT_API_TIMEOUT_MS_CONFIG, 1000);
            try (AdminClient admin = AdminClient.create(cfg)) {
                return admin.describeCluster().clusterId().get(1, TimeUnit.SECONDS);
            }
        });
        return m;
    }

    public Map<String, Componente> checar() {
        Map<String, Componente> resultado = new LinkedHashMap<>();
        checagens.forEach((nome, checagem) -> resultado.put(nome, medir(checagem)));
        return resultado;
    }

    private Componente medir(Callable<?> checagem) {
        long inicio = System.nanoTime();
        Future<?> futuro = null;
        try {
            futuro = executor.submit(checagem);
            futuro.get(timeoutMs, TimeUnit.MILLISECONDS);
            return new Componente("UP", ms(inicio), null);
        } catch (TimeoutException e) {
            futuro.cancel(true);
            return new Componente("DOWN", ms(inicio), "timeout de " + timeoutMs + " ms");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Componente("DOWN", ms(inicio), "interrompido");
        } catch (Exception e) {
            Throwable causa = e.getCause() != null ? e.getCause() : e;
            String msg = causa.getMessage() != null ? causa.getMessage() : causa.getClass().getSimpleName();
            return new Componente("DOWN", ms(inicio), msg.length() > 200 ? msg.substring(0, 200) : msg);
        }
    }

    private static long ms(long inicioNanos) {
        return (System.nanoTime() - inicioNanos) / 1_000_000;
    }
}
