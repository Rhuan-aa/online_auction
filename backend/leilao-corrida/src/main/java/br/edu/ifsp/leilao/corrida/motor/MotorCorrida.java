package br.edu.ifsp.leilao.corrida.motor;

import java.util.Optional;
import java.util.UUID;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

public interface MotorCorrida {
    UUID iniciar(ValidadorParametros.Pedido pedido);

    boolean parar(UUID id);

    Optional<Foto> foto(UUID id);

    Optional<SseEmitter> assinar(UUID id);

    class CorridaEmAndamentoException extends RuntimeException {
        private final UUID corridaId;

        public CorridaEmAndamentoException(UUID atual) {
            super("Já existe uma corrida rodando (" + atual + "). Pare-a ou espere terminar.");
            this.corridaId = atual;
        }

        public UUID corridaId() {
            return corridaId;
        }
    }
}
