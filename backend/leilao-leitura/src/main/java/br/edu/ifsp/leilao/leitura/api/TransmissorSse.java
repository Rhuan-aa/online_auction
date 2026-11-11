package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes;
import br.edu.ifsp.leilao.leitura.projecoes.LeilaoAtualizado;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Mantém as telas abertas (uma conexão SSE por navegador) e empurra o estado novo
 * sempre que a projeção de um leilão muda. É assim que o valor atualiza "ao vivo".
 */
@Component
public class TransmissorSse {

    private static final long SEM_TIMEOUT = 0L;

    private final ConsultaLeiloes consulta;
    /** leilão -> conexões abertas olhando para ele. */
    private final Map<UUID, List<SseEmitter>> conexoes = new ConcurrentHashMap<>();

    public TransmissorSse(ConsultaLeiloes consulta) {
        this.consulta = consulta;
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

        enviar(leilaoId, emissor);
        return emissor;
    }

    /** Chamado pela projeção (via evento do Spring) depois de gravar um evento no banco. */
    @EventListener
    public void aoAtualizar(LeilaoAtualizado aviso) {
        for (SseEmitter emissor : conexoes.getOrDefault(aviso.leilaoId(), List.of())) {
            enviar(aviso.leilaoId(), emissor);
        }
    }

    private void enviar(UUID leilaoId, SseEmitter emissor) {
        consulta.buscar(leilaoId).ifPresent(estado -> {
            try {
                emissor.send(SseEmitter.event().name("leilao").data(estado));
            } catch (IOException | IllegalStateException e) {
                emissor.completeWithError(e); // conexão já morreu; o onError remove da lista
            }
        });
    }
}
