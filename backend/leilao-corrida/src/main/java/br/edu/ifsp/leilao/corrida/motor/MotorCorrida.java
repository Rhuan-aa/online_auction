package br.edu.ifsp.leilao.corrida.motor;

import java.util.Optional;
import java.util.UUID;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** O que a API usa do motor (interface para o controller ser testado com um falso). */
public interface MotorCorrida {

    /** @throws CorridaEmAndamentoException se já há uma corrida rodando */
    UUID iniciar(ValidadorParametros.Pedido pedido);

    /** @return false se a corrida não existe */
    boolean parar(UUID id);

    /** Última foto (ou o Resultado, se terminou). */
    Optional<Foto> foto(UUID id);

    Optional<SseEmitter> assinar(UUID id);

    class CorridaEmAndamentoException extends RuntimeException {
        public CorridaEmAndamentoException(UUID atual) {
            super("Já existe uma corrida rodando (" + atual + "). Pare-a ou espere terminar.");
        }
    }
}
