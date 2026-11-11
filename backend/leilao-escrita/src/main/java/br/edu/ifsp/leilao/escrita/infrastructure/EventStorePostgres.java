package br.edu.ifsp.leilao.escrita.infrastructure;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.escrita.application.ConflitoDeVersaoException;
import br.edu.ifsp.leilao.escrita.application.EventStore;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

/**
 * EventStore no PostgreSQL (tabelas event_store.eventos e event_store.outbox).
 * O UNIQUE(leilao_id, versao) do banco é quem impede dois lances na mesma versão.
 */
@Repository
public class EventStorePostgres implements EventStore {

    /** "LanceRegistrado.v1" -> LanceRegistrado.class (os nomes em TiposEvento seguem o nome do record). */
    private static final Map<String, Class<?>> CLASSE_POR_TIPO = Arrays
            .stream(EventoLeilao.class.getPermittedSubclasses())
            .collect(Collectors.toMap(EventStorePostgres::tipoDe, Function.identity()));

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public EventStorePostgres(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public List<EventoLeilao> carregar(UUID leilaoId) {
        return jdbc.sql("SELECT tipo, dados FROM event_store.eventos WHERE leilao_id = ? ORDER BY versao")
                .param(leilaoId)
                .query((rs, linha) -> (EventoLeilao) json.readValue(rs.getString("dados"),
                        CLASSE_POR_TIPO.get(rs.getString("tipo"))))
                .list();
    }

    /** Evento e linha do outbox na MESMA transação: ou grava os dois, ou nenhum (padrão outbox). */
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
                        .params(leilaoId, versao, tipoDe(evento.getClass()), json.writeValueAsString(evento))
                        .query(Long.class)
                        .single();
                jdbc.sql("INSERT INTO event_store.outbox (evento_id) VALUES (?)").param(eventoId).update();
            } catch (DuplicateKeyException versaoJaExiste) {
                throw new ConflitoDeVersaoException(leilaoId, versao);
            }
        }
    }

    private static String tipoDe(Class<?> classe) {
        return classe.getSimpleName() + ".v1";
    }
}
