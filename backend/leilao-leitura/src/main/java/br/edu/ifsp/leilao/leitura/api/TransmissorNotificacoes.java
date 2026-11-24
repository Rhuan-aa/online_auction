package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.leitura.notificacoes.CanalNotificacao;
import br.edu.ifsp.leilao.leitura.notificacoes.Notificacao;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Canal de notificação por SSE: cada pessoa assina os próprios avisos e recebe só os que chegam
 * depois de assinar (não há caixa de entrada guardada; o log continua sendo o registro).
 */
@Component
public class TransmissorNotificacoes implements CanalNotificacao {
    private static final long SEM_TIMEOUT = 0L;

    private final Map<String, List<SseEmitter>> conexoes = new ConcurrentHashMap<>();

    public SseEmitter assinar(String destinatarioId) {
        SseEmitter emissor = new SseEmitter(SEM_TIMEOUT);
        List<SseEmitter> daPessoa = conexoes.computeIfAbsent(destinatarioId, id -> new CopyOnWriteArrayList<>());
        daPessoa.add(emissor);
        emissor.onCompletion(() -> daPessoa.remove(emissor));
        emissor.onTimeout(() -> daPessoa.remove(emissor));
        emissor.onError(erro -> daPessoa.remove(emissor));
        return emissor;
    }

    int assinantes(String destinatarioId) {
        return conexoes.getOrDefault(destinatarioId, List.of()).size();
    }

    @Override
    public void enviar(Notificacao notificacao) {
        conexoes.getOrDefault(notificacao.destinatarioId(), List.of()).forEach(emissor -> {
            try {
                emissor.send(SseEmitter.event().name("notificacao").data(notificacao));
            } catch (IOException | IllegalStateException e) {
                emissor.completeWithError(e);
            }
        });
    }
}
