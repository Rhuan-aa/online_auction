package br.edu.ifsp.leilao.escrita.infrastructure;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.time.Instant;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * A cada 200 ms, envia ao Kafka os eventos ainda não publicados e marca o outbox.
 * Se cair no meio, o evento é reenviado na próxima rodada (entrega "pelo menos uma vez":
 * por isso os consumidores ignoram versões repetidas).
 */
@Component
public class PublicadorOutbox {

    private record Pendente(long outboxId, long id, UUID leilaoId, int versao, String tipo,
                            Instant criadoEm, String dados) {}

    private final JdbcClient jdbc;
    private final KafkaTemplate<String, String> kafka;
    private final JsonMapper json;

    public PublicadorOutbox(JdbcClient jdbc, KafkaTemplate<String, String> kafka, JsonMapper json) {
        this.jdbc = jdbc;
        this.kafka = kafka;
        this.json = json;
    }

    @Scheduled(fixedDelay = 200)
    public void publicarPendentes() {
        var pendentes = jdbc.sql("""
                        SELECT o.id AS outbox_id, e.id, e.leilao_id, e.versao, e.tipo, e.criado_em, e.dados
                        FROM event_store.outbox o JOIN event_store.eventos e ON e.id = o.evento_id
                        WHERE o.publicado_em IS NULL
                        ORDER BY o.id
                        LIMIT 100""")
                .query((rs, linha) -> new Pendente(rs.getLong("outbox_id"), rs.getLong("id"),
                        rs.getObject("leilao_id", UUID.class), rs.getInt("versao"), rs.getString("tipo"),
                        rs.getTimestamp("criado_em").toInstant(), rs.getString("dados")))
                .list();

        for (Pendente p : pendentes) {
            var envelope = new EnvelopeEvento<JsonNode>(p.id(), p.leilaoId(), p.versao(), p.tipo(),
                    p.criadoEm(), json.readTree(p.dados()));
            // key = leilaoId: todos os eventos de um leilão caem na mesma partição, em ordem.
            kafka.send(Topicos.EVENTOS_LEILAO, p.leilaoId().toString(), json.writeValueAsString(envelope)).join();
            jdbc.sql("UPDATE event_store.outbox SET publicado_em = now() WHERE id = ?").param(p.outboxId()).update();
        }
    }
}
