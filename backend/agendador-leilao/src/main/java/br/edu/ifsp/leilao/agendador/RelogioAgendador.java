package br.edu.ifsp.leilao.agendador;

import br.edu.ifsp.leilao.contratos.ComandoAgendador;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.time.Instant;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/**
 * A cada 1 segundo, pergunta aos Prazos o que venceu e envia o comando ao leilao-escrita.
 * Quem decide se o leilão pode mesmo abrir/fechar é o agregado Leilao (se o comando chegar
 * repetido ou adiantado, ele simplesmente ignora).
 */
@Component
public class RelogioAgendador {

    private final Prazos prazos;
    private final KafkaTemplate<String, String> kafka;
    private final JsonMapper json;

    public RelogioAgendador(Prazos prazos, KafkaTemplate<String, String> kafka, JsonMapper json) {
        this.prazos = prazos;
        this.kafka = kafka;
        this.json = json;
    }

    @Scheduled(fixedDelay = 1000)
    public void verificarPrazos() {
        for (ComandoAgendador comando : prazos.vencidos(Instant.now())) {
            kafka.send(Topicos.COMANDOS_AGENDADOR, comando.leilaoId().toString(), json.writeValueAsString(comando));
        }
    }
}
