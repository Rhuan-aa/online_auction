package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.contratos.ComandoAgendador;
import br.edu.ifsp.leilao.contratos.Topicos;
import br.edu.ifsp.leilao.escrita.application.ServicoLeilao;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

/** Porta de entrada para os comandos do agendador (chegam pelo Kafka, não por HTTP). */
@Component
public class OuvinteAgendador {

    private final ServicoLeilao servico;
    private final JsonMapper json;

    public OuvinteAgendador(ServicoLeilao servico, JsonMapper json) {
        this.servico = servico;
        this.json = json;
    }

    @KafkaListener(topics = Topicos.COMANDOS_AGENDADOR, groupId = "leilao-escrita",
            properties = "auto.offset.reset=earliest")
    public void receber(String mensagem) {
        ComandoAgendador comando = json.readValue(mensagem, ComandoAgendador.class);
        switch (comando.tipo()) {
            case "IniciarLeilao" -> servico.iniciar(comando.leilaoId());
            case "EncerrarLeilao" -> servico.encerrar(comando.leilaoId());
            default -> { } // comando desconhecido: ignora
        }
    }
}
