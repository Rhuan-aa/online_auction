package br.edu.ifsp.leilao.corrida.api;

import br.edu.ifsp.leilao.corrida.motor.Foto;
import br.edu.ifsp.leilao.corrida.motor.MotorCorrida;
import br.edu.ifsp.leilao.corrida.motor.MotorCorrida.CorridaEmAndamentoException;
import br.edu.ifsp.leilao.corrida.motor.ValidadorParametros;
import br.edu.ifsp.leilao.corrida.motor.ValidadorParametros.ParametroInvalidoException;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.JsonNode;

/** API da corrida (contrato em docs/superpowers/specs/2026-11-19-corrida-contrato.md). */
@RestController
@RequestMapping("/corrida")
public class CorridaController {

    record Erro(String erro, String mensagem) {}

    record ErroEmAndamento(String erro, String mensagem, String corridaId) {}

    private final MotorCorrida motor;
    private final long sementePadrao;
    private final ValidadorParametros.Orcamento orcamento;

    public CorridaController(MotorCorrida motor, @Value("${corrida.semente-padrao:42}") long sementePadrao,
                             @Value("${corrida.max-threads:2000}") int maxThreads,
                             @Value("${corrida.max-lances:2000000}") long maxLances) {
        this.motor = motor;
        this.sementePadrao = sementePadrao;
        this.orcamento = new ValidadorParametros.Orcamento(maxThreads, maxLances);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> iniciar(@RequestBody(required = false) JsonNode corpo) {
        ValidadorParametros.Pedido pedido = ValidadorParametros.validar(corpo, sementePadrao, orcamento);
        return Map.of("corridaId", motor.iniciar(pedido).toString());
    }

    @PostMapping("/{id}/parar")
    public ResponseEntity<Void> parar(@PathVariable String id) {
        return uuid(id).filter(motor::parar).isPresent()
                ? ResponseEntity.noContent().build()
                : ResponseEntity.notFound().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Foto> foto(@PathVariable String id) {
        return ResponseEntity.of(uuid(id).flatMap(motor::foto));
    }

    @GetMapping(path = "/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(@PathVariable String id) {
        return ResponseEntity.of(uuid(id).flatMap(motor::assinar));
    }

    private static Optional<UUID> uuid(String id) {
        try {
            return Optional.of(UUID.fromString(id));
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Erro invalido(ParametroInvalidoException e) {
        return new Erro("PARAMETRO_INVALIDO", e.getMessage());
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Erro ilegivel(HttpMessageNotReadableException e) {
        return new Erro("PARAMETRO_INVALIDO", "O corpo não é um JSON válido.");
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.CONFLICT)
    public ErroEmAndamento emAndamento(CorridaEmAndamentoException e) {
        return new ErroEmAndamento("CORRIDA_EM_ANDAMENTO", e.getMessage(), e.corridaId().toString());
    }
}
