package br.edu.ifsp.leilao.estado;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cópia do estado de cada leilão no Redis, em um hash {versao, json} (ADR-003).
 *
 * Duas garantias:
 *  - Só avança: uma cópia mais velha nunca sobrescreve uma mais nova (script Lua, atômico no Redis).
 *  - Nunca derruba o pedido: qualquer falha do Redis vira um aviso no log e o método se comporta
 *    como "não tenho cópia". O sistema continua correto, só mais lento.
 */
@Component
public class CacheEstadoLeilao {

    private static final Logger log = LoggerFactory.getLogger(CacheEstadoLeilao.class);

    /**
     * Grava só se a versão nova for maior que a guardada. Roda inteiro dentro do Redis, então
     * ninguém consegue gravar entre a comparação e a gravação.
     * KEYS[1] = chave; ARGV[1] = versão nova; ARGV[2] = JSON do estado. Devolve 1 se gravou.
     */
    private static final DefaultRedisScript<Long> GRAVAR_SE_MAIS_NOVO = new DefaultRedisScript<>("""
            local atual = tonumber(redis.call('HGET', KEYS[1], 'versao') or '0')
            if tonumber(ARGV[1]) > atual then
              redis.call('HSET', KEYS[1], 'versao', ARGV[1], 'json', ARGV[2])
              return 1
            end
            return 0
            """, Long.class);

    private final StringRedisTemplate redis;
    private final JsonMapper json;

    public CacheEstadoLeilao(StringRedisTemplate redis, JsonMapper json) {
        this.redis = redis;
        this.json = json;
    }

    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        try {
            Object guardado = redis.opsForHash().get(chave(leilaoId), "json");
            return Optional.ofNullable(guardado).map(texto -> json.readValue((String) texto, EstadoLeilao.class));
        } catch (RuntimeException e) {
            avisar("ler", e);
            return Optional.empty();
        }
    }

    /** Devolve true se gravou; false se o Redis já tinha uma versão igual ou mais nova (ou falhou). */
    public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
        try {
            Long gravou = redis.execute(GRAVAR_SE_MAIS_NOVO, List.of(chave(leilaoId)),
                    String.valueOf(estado.versao()), json.writeValueAsString(estado));
            return gravou != null && gravou == 1;
        } catch (RuntimeException e) {
            avisar("gravar", e);
            return false;
        }
    }

    /**
     * leilao:{id}:estado:v1. O SCHEMA_VERSION na chave faz cópias de um formato antigo serem
     * simplesmente ignoradas (e descartadas pelo Redis quando a memória encher).
     */
    static String chave(UUID leilaoId) {
        return "leilao:" + leilaoId + ":estado:v" + EstadoLeilao.SCHEMA_VERSION;
    }

    private static void avisar(String operacao, RuntimeException e) {
        log.warn("Redis indisponível ao {} o estado; seguindo sem cache: {}", operacao, e.toString());
    }
}
