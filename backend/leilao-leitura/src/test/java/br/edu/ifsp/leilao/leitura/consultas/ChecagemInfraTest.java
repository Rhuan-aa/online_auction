package br.edu.ifsp.leilao.leitura.consultas;

import static org.assertj.core.api.Assertions.assertThat;

import br.edu.ifsp.leilao.leitura.consultas.ChecagemInfra.Componente;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Callable;
import org.junit.jupiter.api.Test;

class ChecagemInfraTest {
    private static Map<String, Callable<?>> checks(Callable<?> pg, Callable<?> redis, Callable<?> kafka) {
        Map<String, Callable<?>> m = new LinkedHashMap<>();
        m.put("postgres", pg);
        m.put("redis", redis);
        m.put("kafka", kafka);
        return m;
    }

    @Test
    void todosUp() {
        var r = new ChecagemInfra(checks(() -> 1, () -> "PONG", () -> "id")).checar();
        assertThat(r.keySet()).containsExactly("postgres", "redis", "kafka");
        r.values().forEach(c -> {
            assertThat(c.status()).isEqualTo("UP");
            assertThat(c.erro()).isNull();
        });
    }

    @Test
    void falhaViraDownComErroEOsOutrosContinuamUp() {
        var r = new ChecagemInfra(checks(() -> 1, () -> { throw new IllegalStateException("sem conexao"); }, () -> "id")).checar();
        Componente redis = r.get("redis");
        assertThat(redis.status()).isEqualTo("DOWN");
        assertThat(redis.erro()).contains("sem conexao");
        assertThat(r.get("postgres").status()).isEqualTo("UP");
        assertThat(r.get("kafka").status()).isEqualTo("UP");
    }

    @Test
    void checagemLentaViraDownPorTimeout() {
        var r = new ChecagemInfra(checks(() -> 1, () -> { Thread.sleep(3000); return "x"; }, () -> "id"), 200).checar();
        assertThat(r.get("redis").status()).isEqualTo("DOWN");
        assertThat(r.get("redis").erro()).isNotBlank();
        assertThat(r.get("redis").ms()).isLessThan(2000);
    }
}
