package br.edu.ifsp.leilao.escrita.infrastructure;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import br.edu.ifsp.leilao.escrita.application.ConflitoDeVersaoException;
import br.edu.ifsp.leilao.escrita.application.EventStore;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class EventStorePostgres implements EventStore {
    private final JdbcClient jdbc;
    private final JsonMapper json;

    public EventStorePostgres(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    @Transactional
    public void anexar(UUID leilaoId, int versaoEsperada, List<EventoLeilao> novos) {
        int versao = versaoEsperada;
        for (EventoLeilao evento : novos) {
            versao++;
            try {
                long eventoId = jdbc.sql("""
                                INSERT INTO event_store.eventos (leilao_id, versao, tipo, dados)
                                VALUES (?, ?, ?, ?::jsonb) RETURNING id""")
                        .params(leilaoId, versao, TiposEvento.de(evento), json.writeValueAsString(evento))
                        .query(Long.class)
                        .single();
                jdbc.sql("INSERT INTO event_store.outbox (evento_id) VALUES (?)").param(eventoId).update();
            } catch (DuplicateKeyException versaoJaExiste) {
                throw new ConflitoDeVersaoException(leilaoId, versao);
            }
        }
    }
}
