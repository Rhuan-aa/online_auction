package br.edu.ifsp.leilao.estado;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cópia do estado de cada leilão no Redis, em um hash {versao, json}, e o índice dos leilões
 * abertos (ADR-003).
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
     * Índice dos leilões abertos: sorted set com membro = id do leilão e score = fim (epoch ms).
     * Ordenado pelo fim, que é a ordem da tela. Mantido pelo mesmo script que grava o estado.
     */
    static final String ABERTOS = "leiloes:abertos";

    /** Campo do hash do estado que guarda o JSON (o outro é "versao"). */
    private static final String CAMPO_JSON = "json";

    /**
     * Grava o estado só se a versão nova for maior que a guardada e, junto, atualiza o índice de
     * abertos: ABERTO entra (ou muda o score, se o fim foi prorrogado); qualquer outro status sai.
     * Roda inteiro dentro do Redis: ninguém grava entre a comparação e a gravação, e o índice nunca
     * fica diferente do estado gravado.
     * KEYS[1] = chave do estado; KEYS[2] = índice de abertos;
     * ARGV[1] = versão; ARGV[2] = JSON; ARGV[3] = status; ARGV[4] = fim (epoch ms); ARGV[5] = id.
     * Devolve 1 se gravou.
     */
    private static final DefaultRedisScript<Long> GRAVAR_SE_MAIS_NOVO = new DefaultRedisScript<>("""
            local atual = tonumber(redis.call('HGET', KEYS[1], 'versao') or '0')
            if tonumber(ARGV[1]) <= atual then
              return 0
            end
            redis.call('HSET', KEYS[1], 'versao', ARGV[1], 'json', ARGV[2])
            if ARGV[3] == 'ABERTO' then
              redis.call('ZADD', KEYS[2], ARGV[4], ARGV[5])
            else
              redis.call('ZREM', KEYS[2], ARGV[5])
            end
            return 1
            """, Long.class);

    private final StringRedisTemplate redis;
    private final JsonMapper json;
    /** Falso nas configurações A e B: todo método se comporta como "Redis sem cópia nenhuma". */
    private final boolean ligado;

    public CacheEstadoLeilao(StringRedisTemplate redis, JsonMapper json,
                             @Value("${leilao.cache.configuracao:C}") Configuracao configuracao) {
        this.redis = redis;
        this.json = json;
        this.ligado = configuracao.usaRedis();
    }

    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        if (!ligado) {
            return Optional.empty();
        }
        try {
            Object guardado = redis.opsForHash().get(chave(leilaoId), CAMPO_JSON);
            return Optional.ofNullable(guardado).map(texto -> json.readValue((String) texto, EstadoLeilao.class));
        } catch (RuntimeException e) {
            avisar("ler", e);
            return Optional.empty();
        }
    }

    /**
     * Vários estados de uma vez, numa única ida ao Redis (pipeline). Leilões sem cópia ficam de
     * fora do mapa; com o Redis fora do ar, o mapa vem vazio.
     */
    public Map<UUID, EstadoLeilao> lerVarios(List<UUID> leiloes) {
        if (!ligado) {
            return Map.of();
        }
        try {
            List<Object> jsons = redis.executePipelined((RedisCallback<Object>) conexao -> {
                leiloes.forEach(id -> conexao.hashCommands().hGet(bytes(chave(id)), bytes(CAMPO_JSON)));
                return null; // as respostas vêm na lista devolvida pelo executePipelined, na mesma ordem
            });
            Map<UUID, EstadoLeilao> estados = new HashMap<>();
            for (int i = 0; i < leiloes.size(); i++) {
                if (jsons.get(i) instanceof String texto) {
                    estados.put(leiloes.get(i), json.readValue(texto, EstadoLeilao.class));
                }
            }
            return estados;
        } catch (RuntimeException e) {
            avisar("ler", e);
            return Map.of();
        }
    }

    /** Devolve true se gravou; false se o Redis já tinha uma versão igual ou mais nova (ou falhou). */
    public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
        if (!ligado) {
            return false;
        }
        try {
            Long gravou = redis.execute(GRAVAR_SE_MAIS_NOVO, List.of(chave(leilaoId), ABERTOS),
                    String.valueOf(estado.versao()), json.writeValueAsString(estado), estado.status().name(),
                    String.valueOf(estado.fimEm().toEpochMilli()), leilaoId.toString());
            return gravou != null && gravou == 1;
        } catch (RuntimeException e) {
            avisar("gravar", e);
            return false;
        }
    }

    /**
     * Ids do índice de abertos, do que termina primeiro para o último.
     * Vazio se o Redis estiver fora do ar (quem chama decide o que fazer).
     */
    public Optional<List<UUID>> abertos() {
        if (!ligado) {
            return Optional.empty();
        }
        try {
            Set<String> ids = redis.opsForZSet().range(ABERTOS, 0, -1);
            return Optional.ofNullable(ids).map(lista -> lista.stream().map(UUID::fromString).toList());
        } catch (RuntimeException e) {
            avisar("ler o índice de abertos", e);
            return Optional.empty();
        }
    }

    /**
     * Apaga todas as cópias de estado e o índice de abertos. Só para a ferramenta de reconstrução:
     * KEYS percorre o Redis inteiro, o que é aceitável numa manutenção, não no caminho de um pedido.
     * Devolve quantas chaves apagou.
     */
    public long apagarTudo() {
        Set<String> chaves = new HashSet<>(redis.keys("leilao:*"));
        chaves.add(ABERTOS);
        Long apagadas = redis.delete(chaves);
        return apagadas == null ? 0 : apagadas;
    }

    /**
     * leilao:{id}:estado:v1. O SCHEMA_VERSION na chave faz cópias de um formato antigo serem
     * simplesmente ignoradas (e descartadas pelo Redis quando a memória encher).
     */
    static String chave(UUID leilaoId) {
        return "leilao:" + leilaoId + ":estado:v" + EstadoLeilao.SCHEMA_VERSION;
    }

    private static byte[] bytes(String texto) {
        return texto.getBytes(StandardCharsets.UTF_8);
    }

    private static void avisar(String operacao, RuntimeException e) {
        log.warn("Redis indisponível ao {} o estado; seguindo sem cache: {}", operacao, e.toString());
    }
}
