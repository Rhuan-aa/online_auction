package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes;
import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes.Atividade;
import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes.Lance;
import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes.LeilaoDetalhe;
import br.edu.ifsp.leilao.leitura.projecoes.ConsultaLeiloes.LeilaoResumo;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** API de consulta (PLANO.md, seção 2.5). Só lê o read_model: nunca chama o leilao-escrita. */
@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class ConsultaController {

    private final ConsultaLeiloes consulta;
    private final TransmissorSse transmissor;

    public ConsultaController(ConsultaLeiloes consulta, TransmissorSse transmissor) {
        this.consulta = consulta;
        this.transmissor = transmissor;
    }

    @GetMapping("/leiloes")
    public List<LeilaoResumo> listar(@RequestParam(required = false) String status) {
        return consulta.listar(status);
    }

    @GetMapping("/leiloes/{id}")
    public LeilaoDetalhe buscar(@PathVariable UUID id) {
        return consulta.buscar(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leilão não encontrado"));
    }

    /** Conexão SSE: o navegador fica ouvindo e recebe o estado do leilão a cada mudança. */
    @GetMapping(path = "/leiloes/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter acompanhar(@PathVariable UUID id) {
        return transmissor.assinar(id);
    }

    @GetMapping("/leiloes/{id}/lances")
    public List<Lance> lances(@PathVariable UUID id) {
        return consulta.lances(id);
    }

    @GetMapping("/licitantes/{id}/lances")
    public List<Atividade> atividade(@PathVariable String id) {
        return consulta.atividade(id);
    }
}
