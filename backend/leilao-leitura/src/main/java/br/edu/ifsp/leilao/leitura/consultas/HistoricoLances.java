package br.edu.ifsp.leilao.leitura.consultas;

import br.edu.ifsp.leilao.contratos.TiposEvento;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class HistoricoLances {
    public record Lance(int versao, String licitanteId, long valor, Instant criadoEm) {}

    public record Atividade(UUID leilaoId, long ultimoValor, Instant ultimoLanceEm) {}

    private final JdbcClient jdbc;

    public HistoricoLances(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Lance> doLeilao(UUID leilaoId) {
        return jdbc.sql("""
                        SELECT versao, dados->>'licitanteId' AS licitante_id,
                               (dados->>'valor')::bigint AS valor, criado_em
                        FROM event_store.eventos
                        WHERE leilao_id = ? AND tipo = ?
                        ORDER BY versao""")
                .params(leilaoId, TiposEvento.LANCE_REGISTRADO)
                .query((rs, linha) -> new Lance(rs.getInt("versao"), rs.getString("licitante_id"),
                        rs.getLong("valor"), instante(rs, "criado_em")))
                .list();
    }

    public List<Atividade> doLicitante(String licitanteId) {
        return jdbc.sql("""
                        SELECT * FROM (
                          SELECT DISTINCT ON (leilao_id)
                                 leilao_id, (dados->>'valor')::bigint AS ultimo_valor, criado_em AS ultimo_lance_em
                          FROM event_store.eventos
                          WHERE tipo = ? AND dados->>'licitanteId' = ?
                          ORDER BY leilao_id, versao DESC
                        ) ultimos
                        ORDER BY ultimo_lance_em DESC""")
                .params(TiposEvento.LANCE_REGISTRADO, licitanteId)
                .query((rs, linha) -> new Atividade(rs.getObject("leilao_id", UUID.class), rs.getLong("ultimo_valor"),
                        instante(rs, "ultimo_lance_em")))
                .list();
    }

    private static Instant instante(ResultSet rs, String coluna) throws SQLException {
        return rs.getTimestamp(coluna).toInstant();
    }
}
