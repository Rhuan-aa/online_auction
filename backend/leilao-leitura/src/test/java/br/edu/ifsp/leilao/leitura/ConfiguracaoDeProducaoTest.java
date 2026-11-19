package br.edu.ifsp.leilao.leitura;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Properties;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.YamlPropertiesFactoryBean;
import org.springframework.core.io.ClassPathResource;

class ConfiguracaoDeProducaoTest {
    private static final Properties CONFIG = carregar();

    private static Properties carregar() {
        YamlPropertiesFactoryBean yaml = new YamlPropertiesFactoryBean();
        yaml.setResources(new ClassPathResource("application.yml"));
        return yaml.getObject();
    }

    @Test
    void conectaNoBancoComOPapelDeMenorPrivilegio() {
        assertTrue(CONFIG.getProperty("spring.datasource.username").endsWith(":query_svc}"));
    }

    @Test
    void actuatorExpoeSoSaudeEMetricas() {
        Set<String> expostos = Set.of(CONFIG.getProperty("management.endpoints.web.exposure.include").split("\\s*,\\s*"));
        assertTrue(Set.of("health", "metrics").containsAll(expostos), expostos.toString());
    }

    @Test
    void redisForaDoArNaoDerrubaASaude() {
        assertEquals("false", CONFIG.getProperty("management.health.redis.enabled"));
    }

    @Test
    void configuracaoPadraoDoCacheEhRedisMaisCheckpoint() {
        assertTrue(CONFIG.getProperty("leilao.cache.configuracao").endsWith(":C}"));
    }
}
