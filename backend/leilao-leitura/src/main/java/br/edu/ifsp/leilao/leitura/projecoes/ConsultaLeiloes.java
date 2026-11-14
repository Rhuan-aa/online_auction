package br.edu.ifsp.leilao.leitura.projecoes;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Leituras prontas do read_model. Cada consulta é um SELECT simples, sem reconstruir nada. */
@Repository
public class ConsultaLeiloes {

    public record Lance(int versao, String licitanteId, long valor, Instant criadoEm) {}
    public record Atividade(UUID leilaoId, long ultimoValor, Instant ultimoLanceEm) {}

    private final JdbcClient jdbc;

    public ConsultaLeiloes(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Lance> lances(UUID leilaoId) {
        return jdbc.sql("""
                        SELECT versao, licitante_id, valor, criado_em FROM read_model.historico_lances
                        WHERE leilao_id = ? ORDER BY versao""")
                .param(leilaoId)
                .query((rs, linha) -> new Lance(rs.getInt("versao"), rs.getString("licitante_id"), rs.getLong("valor"),
                        instante(rs, "criado_em")))
                .list();
    }

    public List<Atividade> atividade(String licitanteId) {
        return jdbc.sql("""
                        SELECT leilao_id, ultimo_valor, ultimo_lance_em FROM read_model.atividade_licitantes
                        WHERE licitante_id = ? ORDER BY ultimo_lance_em DESC""")
                .param(licitanteId)
                .query((rs, linha) -> new Atividade(rs.getObject("leilao_id", UUID.class), rs.getLong("ultimo_valor"),
                        instante(rs, "ultimo_lance_em")))
                .list();
    }

    private static Instant instante(ResultSet rs, String coluna) throws SQLException {
        return rs.getTimestamp(coluna).toInstant();
    }
}
