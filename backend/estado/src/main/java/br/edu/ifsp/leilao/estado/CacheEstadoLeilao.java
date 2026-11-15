package br.edu.ifsp.leilao.estado;

import java.util.ArrayList;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cópia do estado de cada leilão no Redis e o índice dos leilões abertos (ADR-003).
 * Usa só comandos básicos do Redis:
 *
 *   leilao:{id}:estado:v1  → texto com o JSON do estado     (GET, SET, MGET)
 *   leiloes:abertos        → conjunto com os ids abertos     (SADD, SREM, SMEMBERS)
 *
 * Regra de ouro: o Redis nunca derruba o pedido. Qualquer falha vira um aviso no log e o método
 * se comporta como "não tenho cópia". O sistema continua correto, só mais lento.
 */
@Component
public class CacheEstadoLeilao {

    private static final Logger log = LoggerFactory.getLogger(CacheEstadoLeilao.class);

    /** Conjunto (SET do Redis) com os ids dos leilões abertos. A ordem da tela é feita em Java. */
    static final String ABERTOS = "leiloes:abertos";

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

    /** GET leilao:{id}:estado:v1 */
    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        if (!ligado) {
            return Optional.empty();
        }
        try {
            String texto = redis.opsForValue().get(chave(leilaoId));
            return Optional.ofNullable(texto).map(t -> json.readValue(t, EstadoLeilao.class));
        } catch (RuntimeException e) {
            avisar("ler", e);
            return Optional.empty();
        }
    }

    /**
     * MGET chave1 chave2 ...: vários estados numa ida só ao Redis.
     * Leilões sem cópia ficam de fora do mapa; com o Redis fora do ar, o mapa vem vazio.
     */
    public Map<UUID, EstadoLeilao> lerVarios(List<UUID> leiloes) {
        if (!ligado || leiloes.isEmpty()) {
            return Map.of();
        }
        try {
            List<String> chaves = new ArrayList<>();
            for (UUID id : leiloes) {
                chaves.add(chave(id));
            }
            List<String> textos = redis.opsForValue().multiGet(chaves); // mesma ordem das chaves
            Map<UUID, EstadoLeilao> estados = new HashMap<>();
            for (int i = 0; i < leiloes.size(); i++) {
                String texto = textos.get(i);
                if (texto != null) {
                    estados.put(leiloes.get(i), json.readValue(texto, EstadoLeilao.class));
                }
            }
            return estados;
        } catch (RuntimeException e) {
            avisar("ler", e);
            return Map.of();
        }
    }

    /**
     * Grava o estado se ele for mais novo que o guardado, e acerta o índice de abertos.
     *  1. GET  a cópia atual; se a versão dela for igual ou maior, não faz nada.
     *  2. SET  o JSON novo.
     *  3. SADD (se ABERTO) ou SREM (qualquer outro status) no conjunto de abertos.
     * Devolve true se gravou.
     *
     * ponytail: GET e SET são dois comandos separados; se duas gravações do mesmo leilão se
     * cruzarem, uma cópia mais velha pode ganhar. Não quebra nada: quem lê completa a cópia com os
     * eventos posteriores, e o lance é protegido pelo banco (versaoEsperada). Para fechar a brecha,
     * trocar por WATCH/MULTI/EXEC ou um script Lua.
     */
    public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
        if (!ligado) {
            return false;
        }
        try {
            Optional<EstadoLeilao> atual = ler(leilaoId);
            if (atual.isPresent() && atual.get().versao() >= estado.versao()) {
                return false;
            }
            redis.opsForValue().set(chave(leilaoId), json.writeValueAsString(estado));
            if (estado.status() == EstadoLeilao.Status.ABERTO) {
                redis.opsForSet().add(ABERTOS, leilaoId.toString());
            } else {
                redis.opsForSet().remove(ABERTOS, leilaoId.toString());
            }
            return true;
        } catch (RuntimeException e) {
            avisar("gravar", e);
            return false;
        }
    }

    /** SMEMBERS leiloes:abertos. Vazio se o Redis estiver fora do ar (quem chama decide o que fazer). */
    public Optional<List<UUID>> abertos() {
        if (!ligado) {
            return Optional.empty();
        }
        try {
            Set<String> ids = redis.opsForSet().members(ABERTOS);
            return Optional.ofNullable(ids).map(lista -> lista.stream().map(UUID::fromString).toList());
        } catch (RuntimeException e) {
            avisar("ler o índice de abertos", e);
            return Optional.empty();
        }
    }

    /**
     * KEYS leilao:* e DEL: apaga todas as cópias e o índice. Só para a ferramenta de reconstrução
     * (KEYS percorre o Redis inteiro: aceitável numa manutenção, não no caminho de um pedido).
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

    private static void avisar(String operacao, RuntimeException e) {
        log.warn("Redis indisponível ao {} o estado; seguindo sem cache: {}", operacao, e.toString());
    }
}
