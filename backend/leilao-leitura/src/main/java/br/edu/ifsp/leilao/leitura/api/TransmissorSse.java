package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.contratos.Topicos;
import br.edu.ifsp.leilao.estado.ObterEstado;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Mantém as telas abertas (uma conexão SSE por navegador) e empurra o estado novo a cada evento
 * do leilão que chega pelo Kafka. É assim que o valor atualiza "ao vivo".
 *
 * De quebra, conserta o cache: para cada evento, pede o estado com versão mínima igual à do
 * evento. Se a escrita não conseguiu gravar a cópia no Redis (Redis fora, por exemplo), a cópia
 * fica atrás, e este pedido completa com o Event Store e regrava. Por isso faz isso mesmo quando
 * ninguém está assistindo ao leilão.
 */
@Component
public class TransmissorSse {

    private static final long SEM_TIMEOUT = 0L;

    private final ObterEstado obterEstado;
    private final JsonMapper json;
    /** leilão -> conexões abertas olhando para ele. */
    private final Map<UUID, List<SseEmitter>> conexoes = new ConcurrentHashMap<>();

    public TransmissorSse(ObterEstado obterEstado, JsonMapper json) {
        this.obterEstado = obterEstado;
        this.json = json;
    }

    /** Abre a conexão e já manda o estado atual, para a tela não começar vazia. */
    public SseEmitter assinar(UUID leilaoId) {
        SseEmitter emissor = new SseEmitter(SEM_TIMEOUT);
        List<SseEmitter> doLeilao = conexoes.computeIfAbsent(leilaoId, id -> new CopyOnWriteArrayList<>());
        doLeilao.add(emissor);

        // Quando o navegador fecha a aba (ou dá erro), esquecemos a conexão.
        emissor.onCompletion(() -> doLeilao.remove(emissor));
        emissor.onTimeout(() -> doLeilao.remove(emissor));
        emissor.onError(erro -> doLeilao.remove(emissor));

        obterEstado.obterParaConsulta(leilaoId, 0).ifPresent(estado -> enviar(emissor, LeilaoDetalhe.de(leilaoId, estado)));
        return emissor;
    }

    /**
     * Um group novo por instância (random.uuid): cada instância da leitura recebe TODOS os eventos,
     * porque cada uma tem as próprias conexões abertas. Começa do fim do tópico (padrão do Kafka
     * para um group novo): só interessa o que acontece daqui para frente.
     */
    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "leilao-leitura-sse-${random.uuid}")
    public void aoReceberEvento(String mensagem) {
        JsonNode envelope = json.readTree(mensagem);
        UUID leilaoId = UUID.fromString(envelope.get("leilaoId").asString());
        int versaoDoEvento = envelope.get("versao").asInt();

        obterEstado.obterParaConsulta(leilaoId, versaoDoEvento).ifPresent(estado -> {
            LeilaoDetalhe detalhe = LeilaoDetalhe.de(leilaoId, estado);
            conexoes.getOrDefault(leilaoId, List.of()).forEach(emissor -> enviar(emissor, detalhe));
        });
    }

    private void enviar(SseEmitter emissor, LeilaoDetalhe detalhe) {
        try {
            emissor.send(SseEmitter.event().name("leilao").data(detalhe));
        } catch (IOException | IllegalStateException e) {
            emissor.completeWithError(e); // conexão já morreu; o onError remove da lista
        }
    }
}
