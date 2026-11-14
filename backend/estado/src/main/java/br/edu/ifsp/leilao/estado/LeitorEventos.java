package br.edu.ifsp.leilao.estado;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lê o Event Store (a fonte da verdade). Só SELECT: quem grava eventos é o leilao-escrita.
 * Fica no módulo estado porque a escrita e a leitura precisam dele para montar o estado.
 */
@Repository
public class LeitorEventos {

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public LeitorEventos(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * Eventos com versão MAIOR que a dada, em ordem. É o que falta aplicar sobre uma cópia
     * que está na versão informada. Com versão 0, são todos os eventos do leilão.
     */
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

    /** Ids de todos os leilões: cada leilão tem exatamente um evento de versão 1 (o LeilaoCriado). */
    public List<UUID> idsDosLeiloes() {
        return jdbc.sql("SELECT leilao_id FROM event_store.eventos WHERE versao = 1")
                .query(UUID.class)
                .list();
    }
}
