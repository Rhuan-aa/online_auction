package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;

public final class ArquiteturaEsSnapshot extends ArquiteturaEventos {
    public static final String ID = "es-snapshot";
    public static final int INTERVALO = 50;

    private static final String SNAPSHOT = "corrida_es_snapshot.snapshot";

    public ArquiteturaEsSnapshot(JdbcClient jdbc) {
        super(jdbc, ID, "ES + snapshot", "Eventos imutáveis; parte do snapshot gravado a cada 50 eventos",
                "corrida_es_snapshot", List.of("snapshot"));
    }

    @Override
    protected EstadoLeilao carregarParaEscrita(Contadores c) {
        return montar(c);
    }

    @Override
    public Leitura consultar() {
        return leitura(montar(custosLeitura));
    }

    private EstadoLeilao montar(Contadores c) {
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

    @Override
    protected void aposGravar(EstadoLeilao novo, Contadores c) {
        if (novo.versao() % INTERVALO != 0) {
            return;
        }
        c.escritaBanco();
        jdbc.sql("""
                        INSERT INTO corrida_es_snapshot.snapshot (leilao_id, versao, preco_inicial, incremento, preco_atual, lider)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT (leilao_id) DO UPDATE
                          SET versao = EXCLUDED.versao, preco_atual = EXCLUDED.preco_atual, lider = EXCLUDED.lider
                          WHERE snapshot.versao < EXCLUDED.versao""")
                .params(leilao.leilaoId(), novo.versao(), novo.precoInicial(), novo.incremento(), novo.precoAtual(),
                        novo.lider())
                .update();
    }
}
