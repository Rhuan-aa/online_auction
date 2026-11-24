package br.edu.ifsp.leilao.leitura.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Os avisos do Notificador (lance superado, vitória) para uma pessoa, ao vivo por SSE. */
@RestController
public class NotificacaoController {
    private final TransmissorNotificacoes transmissor;

    public NotificacaoController(TransmissorNotificacoes transmissor) {
        this.transmissor = transmissor;
    }

    @GetMapping(path = "/licitantes/{id}/notificacoes/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter assinar(@PathVariable String id) {
        return transmissor.assinar(id);
    }
}
