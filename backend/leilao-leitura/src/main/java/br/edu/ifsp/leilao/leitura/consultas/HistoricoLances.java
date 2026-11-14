package br.edu.ifsp.leilao.leitura.consultas;

import br.edu.ifsp.leilao.contratos.TiposEvento;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Históricos de lances, lidos direto do Event Store (a fonte da verdade): cada lance aceito é um
 * evento LanceRegistrado. Sem cópia nenhuma, então nunca ficam atrasados.
 *
 * Os campos saem do JSON do evento pelos operadores do Postgres: dados->>'licitanteId' devolve o
 * texto do campo, e (dados->>'valor')::bigint o converte para número.
 */
@Repository
public class HistoricoLances {

    /** Item de GET /leiloes/{id}/lances: o mesmo JSON de antes. */
    public record Lance(int versao, String licitanteId, long valor, Instant criadoEm) {}

    /** Item de GET /licitantes/{id}/lances: o último lance do licitante em cada leilão. */
    public record Atividade(UUID leilaoId, long ultimoValor, Instant ultimoLanceEm) {}

    private final JdbcClient jdbc;

    public HistoricoLances(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Os lances aceitos de um leilão, em ordem. Usa o índice do UNIQUE(leilao_id, versao). */
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

    /**
     * O último lance do licitante em cada leilão, do mais recente para o mais antigo.
     * DISTINCT ON (leilao_id) + ORDER BY versao DESC fica com uma linha por leilão: a de maior versão.
     * Usa o índice eventos_lances_por_licitante (infra/sql/001_event_store.sql).
     */
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
