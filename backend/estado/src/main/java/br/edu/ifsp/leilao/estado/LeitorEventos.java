package br.edu.ifsp.leilao.estado;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class LeitorEventos {
    public record EventoGravado(int versao, String tipo, JsonNode dados, Instant criadoEm) {}

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public LeitorEventos(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public List<EventoLeilao> posteriores(UUID leilaoId, int versao) {
        return jdbc.sql("""
                        SELECT tipo, dados FROM event_store.eventos
                        WHERE leilao_id = ? AND versao > ?
                        ORDER BY versao""")
                .params(leilaoId, versao)
                .query((rs, linha) -> (EventoLeilao) json.readValue(rs.getString("dados"),
                        TiposEvento.classeDe(rs.getString("tipo"))))
                .list();
    }

    public List<EventoLeilao> ateVersao(UUID leilaoId, int n) {
        return jdbc.sql("""
                        SELECT tipo, dados FROM event_store.eventos
                        WHERE leilao_id = ? AND versao <= ?
                        ORDER BY versao""")
                .params(leilaoId, n)
                .query((rs, linha) -> (EventoLeilao) json.readValue(rs.getString("dados"),
                        TiposEvento.classeDe(rs.getString("tipo"))))
                .list();
    }

    public List<EventoGravado> todos(UUID leilaoId) {
        return jdbc.sql("""
                        SELECT versao, tipo, dados, criado_em FROM event_store.eventos
                        WHERE leilao_id = ?
                        ORDER BY versao""")
                .params(leilaoId)
                .query((rs, linha) -> new EventoGravado(rs.getInt("versao"), rs.getString("tipo"),
                        json.readTree(rs.getString("dados")), rs.getTimestamp("criado_em").toInstant()))
                .list();
    }

    public List<UUID> idsDosLeiloes() {
        return jdbc.sql("SELECT leilao_id FROM event_store.eventos WHERE versao = 1")
                .query(UUID.class)
                .list();
    }
}
