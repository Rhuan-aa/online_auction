package br.edu.ifsp.leilao.leitura.projecoes;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import org.springframework.context.ApplicationEventPublisher;
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

    /** Nome do consumer group. Público porque o health check de lag e o reprocessador precisam dele. */
    public static final String GRUPO = "leilao-leitura-projecoes";

    private final ProjecaoLeilao projecao;
    private final JsonMapper json;
    private final ApplicationEventPublisher avisos;

    public OuvinteProjecao(ProjecaoLeilao projecao, JsonMapper json, ApplicationEventPublisher avisos) {
        this.projecao = projecao;
        this.json = json;
        this.avisos = avisos;
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = GRUPO, properties = "auto.offset.reset=earliest")
    public void receber(String mensagem) {
        EnvelopeEvento<JsonNode> evento = json.readValue(mensagem, ENVELOPE);
        projecao.aplicar(evento); // grava no banco (a transação termina aqui)
        avisos.publishEvent(new LeilaoAtualizado(evento.leilaoId())); // só então avisa quem está ao vivo
    }
}
