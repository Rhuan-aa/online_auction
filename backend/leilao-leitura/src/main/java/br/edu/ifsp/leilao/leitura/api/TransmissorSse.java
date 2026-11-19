package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.contratos.Topicos;
import br.edu.ifsp.leilao.estado.cache.ObterEstado;
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

@Component
public class TransmissorSse {
    private static final long SEM_TIMEOUT = 0L;

    private final ObterEstado obterEstado;
    private final JsonMapper json;

    private final Map<UUID, List<SseEmitter>> conexoes = new ConcurrentHashMap<>();

    public TransmissorSse(ObterEstado obterEstado, JsonMapper json) {
        this.obterEstado = obterEstado;
        this.json = json;
    }

    public SseEmitter assinar(UUID leilaoId) {
        SseEmitter emissor = new SseEmitter(SEM_TIMEOUT);
        List<SseEmitter> doLeilao = conexoes.computeIfAbsent(leilaoId, id -> new CopyOnWriteArrayList<>());
        doLeilao.add(emissor);

        emissor.onCompletion(() -> doLeilao.remove(emissor));
        emissor.onTimeout(() -> doLeilao.remove(emissor));
        emissor.onError(erro -> doLeilao.remove(emissor));

        obterEstado.obterParaConsulta(leilaoId, 0).ifPresent(estado -> enviar(emissor, LeilaoDetalhe.de(leilaoId, estado)));
        return emissor;
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "leilao-leitura-sse-${random.uuid}")
    public void aoReceberEvento(String mensagem) {
        JsonNode envelope = json.readTree(mensagem);
        UUID leilaoId = UUID.fromString(envelope.get("leilaoId").asString());
        int versaoDoEvento = envelope.get("versao").asInt();
        String tipo = envelope.get("tipo").asString();

        obterEstado.obterParaConsulta(leilaoId, versaoDoEvento).ifPresent(estado -> {
            LeilaoDetalhe detalhe = LeilaoDetalhe.de(leilaoId, estado)
                    .comEvento(new LeilaoDetalhe.EventoInfo(tipo, versaoDoEvento));
            conexoes.getOrDefault(leilaoId, List.of()).forEach(emissor -> enviar(emissor, detalhe));
        });
    }

    private void enviar(SseEmitter emissor, LeilaoDetalhe detalhe) {
        try {
            emissor.send(SseEmitter.event().name("leilao").data(detalhe));
        } catch (IOException | IllegalStateException e) {
            emissor.completeWithError(e);
        }
    }
}
