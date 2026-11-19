package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;

final class CopiaRedis {
    private static final DefaultRedisScript<Long> GRAVAR_SE_MAIS_NOVA = new DefaultRedisScript<>("""
            local atual = redis.call('GET', KEYS[1])
            if atual then
              local v = tonumber(string.match(atual, '^(%d+)'))
              if v and v >= tonumber(ARGV[1]) then return 0 end
            end
            redis.call('SET', KEYS[1], ARGV[2])
            return 1""", Long.class);

    private final StringRedisTemplate redis;
    private final String prefixo;
    private final String chaveEstado;

    CopiaRedis(StringRedisTemplate redis, String arquitetura) {
        this.redis = redis;
        this.prefixo = "corrida:" + arquitetura + ":";
        this.chaveEstado = prefixo + "estado";
    }

    Optional<EstadoLeilao> ler(Contadores c) {
        c.opRedis();
        return Optional.ofNullable(redis.opsForValue().get(chaveEstado)).map(CopiaRedis::decodificar);
    }

    void gravarSeMaisNova(EstadoLeilao e, Contadores c) {
        c.opRedis();
        redis.execute(GRAVAR_SE_MAIS_NOVA, List.of(chaveEstado), Integer.toString(e.versao()), codificar(e));
    }

    void apagarTudo() {
        List<String> chaves = chaves();
        if (!chaves.isEmpty()) {
            redis.delete(chaves);
        }
    }

    long contarChaves() {
        return chaves().size();
    }

    private List<String> chaves() {
        List<String> chaves = new ArrayList<>();
        try (Cursor<String> cursor = redis.scan(ScanOptions.scanOptions().match(prefixo + "*").count(200).build())) {
            cursor.forEachRemaining(chaves::add);
        }
        return chaves;
    }

    static String codificar(EstadoLeilao e) {
        return e.versao() + "|" + e.precoAtual() + "|" + (e.lider() == null ? "" : e.lider()) + "|"
                + e.precoInicial() + "|" + e.incremento();
    }

    static EstadoLeilao decodificar(String s) {
        String[] p = s.split("\\|", -1);
        return new EstadoLeilao(Long.parseLong(p[3]), Long.parseLong(p[4]), Long.parseLong(p[1]),
                p[2].isEmpty() ? null : p[2], Integer.parseInt(p[0]), true);
    }
}
