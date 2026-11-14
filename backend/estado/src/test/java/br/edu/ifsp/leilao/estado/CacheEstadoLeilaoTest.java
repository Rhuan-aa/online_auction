package br.edu.ifsp.leilao.estado;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import tools.jackson.databind.json.JsonMapper;

/** Sem Redis de verdade: o que importa aqui é o cache nunca derrubar o pedido. */
class CacheEstadoLeilaoTest {

    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final EstadoLeilao ESTADO = EstadoLeilao.INICIAL.aplicarTodos(EstadoLeilaoTest.EVENTOS);

    final JsonMapper json = JsonMapper.builder().build();
    LettuceConnectionFactory fabrica;

    /** Um cache apontando para uma porta onde nada responde: é o "Redis fora do ar". */
    CacheEstadoLeilao cacheComRedisDesligado() {
        fabrica = new LettuceConnectionFactory(new RedisStandaloneConfiguration("localhost", 1));
        fabrica.afterPropertiesSet();
        fabrica.start();
        StringRedisTemplate redis = new StringRedisTemplate(fabrica);
        return new CacheEstadoLeilao(redis, json);
    }

    @AfterEach
    void fechar() {
        if (fabrica != null) {
            fabrica.destroy();
        }
    }

    @Test
    void comRedisDesligadoLerDevolveVazioEGravarNaoLanca() {
        CacheEstadoLeilao cache = cacheComRedisDesligado();
        assertEquals(Optional.empty(), cache.ler(ID));
        assertFalse(cache.gravar(ID, ESTADO));
    }

    /** O estado sai do Redis igual ao que entrou (ida e volta pelo JSON). */
    @Test
    void jsonDeIdaEVoltaDevolveOMesmoEstado() {
        String texto = json.writeValueAsString(ESTADO);
        assertEquals(ESTADO, json.readValue(texto, EstadoLeilao.class));
    }

    @Test
    void chaveTemOIdEAVersaoDoFormato() {
        assertEquals("leilao:" + ID + ":estado:v1", CacheEstadoLeilao.chave(ID));
    }
}
