package br.edu.ifsp.leilao.leitura.projecoes;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Porta de entrada da projeção: recebe cada evento do Kafka e entrega à ProjecaoLeilao.
 * Começa do início do tópico na primeira vez (earliest): é assim que o replay reconstrói as tabelas.
 */
@Component
public class OuvinteProjecao {

    private static final TypeReference<EnvelopeEvento<JsonNode>> ENVELOPE = new TypeReference<>() {};

    private final ProjecaoLeilao projecao;
    private final JsonMapper json;

    public OuvinteProjecao(ProjecaoLeilao projecao, JsonMapper json) {
        this.projecao = projecao;
        this.json = json;
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "leilao-leitura-projecoes",
            properties = "auto.offset.reset=earliest")
    public void receber(String mensagem) {
        projecao.aplicar(json.readValue(mensagem, ENVELOPE));
    }
}
