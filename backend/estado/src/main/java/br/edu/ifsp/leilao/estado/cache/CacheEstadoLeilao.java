package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
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
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class CacheEstadoLeilao {
    private static final Logger log = LoggerFactory.getLogger(CacheEstadoLeilao.class);

    static final String ABERTOS = "leiloes:abertos";

    static final String MARCADOR = "__completo__";

    private final StringRedisTemplate redis;
    private final JsonMapper json;

    private final ConfiguracaoAtiva configuracao;

    public CacheEstadoLeilao(StringRedisTemplate redis, JsonMapper json, ConfiguracaoAtiva configuracao) {
        this.redis = redis;
        this.json = json;
        this.configuracao = configuracao;
    }

    private boolean ligado() {
        return configuracao.atual().usaRedis();
    }

    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        if (!ligado()) {
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

    public Map<UUID, EstadoLeilao> lerVarios(List<UUID> leiloes) {
        if (!ligado() || leiloes.isEmpty()) {
            return Map.of();
        }
        try {
            List<String> chaves = new ArrayList<>();
            for (UUID id : leiloes) {
                chaves.add(chave(id));
            }
            List<String> textos = redis.opsForValue().multiGet(chaves);
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

    public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
        if (!ligado()) {
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

    public Optional<List<UUID>> abertos() {
        if (!ligado()) {
            return Optional.empty();
        }
        try {
            Set<String> membros = redis.opsForSet().members(ABERTOS);
            if (membros == null || !membros.contains(MARCADOR)) {
                return Optional.empty();
            }
            return Optional.of(membros.stream()
                    .filter(membro -> !MARCADOR.equals(membro))
                    .map(UUID::fromString)
                    .toList());
        } catch (RuntimeException e) {
            avisar("ler o índice de abertos", e);
            return Optional.empty();
        }
    }

    public void repovoarAbertos(Map<UUID, EstadoLeilao> estados) {
        if (!ligado()) {
            return;
        }
        List<String> membros = new ArrayList<>();
        estados.forEach((id, estado) -> {
            if (estado.status() == EstadoLeilao.Status.ABERTO) {
                membros.add(id.toString());
            }
        });
        membros.add(MARCADOR);
        try {
            redis.opsForSet().add(ABERTOS, membros.toArray(String[]::new));
        } catch (RuntimeException e) {
            avisar("refazer o índice de abertos", e);
        }
    }

    public long apagarTudo() {
        Set<String> chaves = new HashSet<>(redis.keys("leilao:*"));
        chaves.add(ABERTOS);
        Long apagadas = redis.delete(chaves);
        return apagadas == null ? 0 : apagadas;
    }

    static String chave(UUID leilaoId) {
        return "leilao:" + leilaoId + ":estado:v" + EstadoLeilao.SCHEMA_VERSION;
    }

    private static void avisar(String operacao, RuntimeException e) {
        log.warn("Redis indisponível ao {} o estado; seguindo sem cache: {}", operacao, e.toString());
    }
}
