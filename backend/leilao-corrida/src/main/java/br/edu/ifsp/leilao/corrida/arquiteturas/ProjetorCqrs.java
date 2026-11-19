package br.edu.ifsp.leilao.corrida.arquiteturas;

import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class ProjetorCqrs {
    private final ArquiteturaEsCqrs cqrs;

    public ProjetorCqrs(ArquiteturaEsCqrs cqrs) {
        this.cqrs = cqrs;
    }

    @KafkaListener(topics = ArquiteturaEsCqrs.TOPICO, groupId = "leilao-corrida-cqrs")
    public void aoReceber(String mensagem) {
        cqrs.projetar(mensagem);
    }
}
