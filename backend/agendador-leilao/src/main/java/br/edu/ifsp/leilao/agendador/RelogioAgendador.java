package br.edu.ifsp.leilao.agendador;

import br.edu.ifsp.leilao.contratos.ComandoAgendador;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.time.Instant;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

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
