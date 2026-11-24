package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;

public final class ArquiteturaEsCache extends ArquiteturaEventos {
    public static final String ID = "es-cache";
    public static final int INTERVALO = 50;

    private static final String SNAPSHOT = "corrida_es_cache.snapshot";

    private final CopiaRedis cache;

    public ArquiteturaEsCache(JdbcClient jdbc, StringRedisTemplate redis) {
        super(jdbc, ID, "ES + cache + snapshot",
                "Eventos imutáveis + cópia versionada no Redis + snapshot a cada 50 eventos",
                "corrida_es_cache", List.of("snapshot"));
        this.cache = new CopiaRedis(redis, ID);
    }

    @Override
    public void preparar(LeilaoInicial inicial) {
        cache.apagarTudo();
        super.preparar(inicial);
    }

    @Override
    protected void aposPreparar(EstadoLeilao inicial) {
        cache.gravarSeMaisNova(inicial, Contadores.descartavel());
    }

    @Override
    protected EstadoLeilao carregarParaEscrita(Contadores c) {
        Optional<EstadoLeilao> copia = cache.ler(c);
        return copia.isPresent() ? aplicarEventos(copia.get(), copia.get().versao(), c) : pelaFonte(c);
    }

    @Override
    protected void aposGravar(EstadoLeilao novo, Contadores c) {
        cache.gravarSeMaisNova(novo, c);
        if (novo.versao() % INTERVALO == 0) {
            gravarSnapshot(novo, c);
        }
    }

    @Override
    public Leitura consultar() {
        Optional<EstadoLeilao> copia = cache.ler(custosLeitura);
        if (copia.isPresent()) {
            return leitura(copia.get());
        }
        EstadoLeilao estado = pelaFonte(custosLeitura);
        cache.gravarSeMaisNova(estado, custosLeitura);
        return leitura(estado);
    }

    /** Sem cópia no Redis: parte do snapshot (se houver) e aplica só os eventos posteriores. */
    private EstadoLeilao pelaFonte(Contadores c) {
        Optional<EstadoLeilao> foto = lerSnapshot(c);
        return foto.isPresent() ? aplicarEventos(foto.get(), foto.get().versao(), c) : replayCompleto(c);
    }

    private Optional<EstadoLeilao> lerSnapshot(Contadores c) {
        c.leituraBanco();
        return jdbc.sql("SELECT versao, preco_inicial, incremento, preco_atual, lider FROM " + SNAPSHOT + " WHERE leilao_id = ?")
                .param(leilao.leilaoId())
                .query((rs, n) -> new EstadoLeilao(rs.getLong("preco_inicial"), rs.getLong("incremento"),
                        rs.getLong("preco_atual"), rs.getString("lider"), rs.getInt("versao"), true))
                .optional();
    }

    private void gravarSnapshot(EstadoLeilao novo, Contadores c) {
        c.escritaBanco();
        jdbc.sql("""
                        INSERT INTO corrida_es_cache.snapshot (leilao_id, versao, preco_inicial, incremento, preco_atual, lider)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT (leilao_id) DO UPDATE
                          SET versao = EXCLUDED.versao, preco_atual = EXCLUDED.preco_atual, lider = EXCLUDED.lider
                          WHERE snapshot.versao < EXCLUDED.versao""")
                .params(leilao.leilaoId(), novo.versao(), novo.precoInicial(), novo.incremento(), novo.precoAtual(),
                        novo.lider())
                .update();
    }

    @Override
    protected long chavesRedis() {
        return cache.contarChaves();
    }
}
