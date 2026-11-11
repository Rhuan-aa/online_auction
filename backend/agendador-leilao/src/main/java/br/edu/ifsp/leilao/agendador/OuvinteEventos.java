package br.edu.ifsp.leilao.agendador;

import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.util.UUID;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Lê os eventos do leilão e mantém os prazos atualizados.
 *
 * O consumer group é novo a cada inicialização (${random.uuid}) e começa do início do tópico:
 * assim, ao reiniciar, o agendador relê todos os eventos e reconstrói os prazos sozinho.
 */
@Component
public class OuvinteEventos {

    private final Prazos prazos;
    private final JsonMapper json;

    public OuvinteEventos(Prazos prazos, JsonMapper json) {
        this.prazos = prazos;
        this.json = json;
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "agendador-leilao-${random.uuid}",
            properties = "auto.offset.reset=earliest")
    public void receber(String mensagem) {
        JsonNode envelope = json.readTree(mensagem);
        UUID leilaoId = UUID.fromString(envelope.get("leilaoId").asString());
        JsonNode dados = envelope.get("dados");

        switch (envelope.get("tipo").asString()) {
            case TiposEvento.LEILAO_CRIADO -> {
                LeilaoCriado criado = json.treeToValue(dados, LeilaoCriado.class);
                prazos.registrar(leilaoId, criado.inicioEm(), criado.fimEm());
            }
            case TiposEvento.LEILAO_INICIADO -> prazos.aberto(leilaoId);
            case TiposEvento.LEILAO_PRORROGADO ->
                    prazos.prorrogado(leilaoId, json.treeToValue(dados, LeilaoProrrogado.class).novoFimEm());
            case TiposEvento.LEILAO_ENCERRADO, TiposEvento.LEILAO_CANCELADO -> prazos.terminado(leilaoId);
            default -> { } // LanceRegistrado não muda prazo
        }
    }
}
