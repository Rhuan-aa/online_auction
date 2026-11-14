package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.estado.ObterEstado;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances.Atividade;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances.Lance;
import br.edu.ifsp.leilao.leitura.consultas.ListagemLeiloes;
import br.edu.ifsp.leilao.leitura.consultas.ListagemLeiloes.LeilaoResumo;
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

/**
 * API de consulta (PLANO.md, seção 2.5). Nunca chama o leilao-escrita.
 * O estado e a lista vêm do cache (módulo estado); os históricos de lances, do Event Store.
 */
@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class ConsultaController {

    private final ListagemLeiloes listagem;
    private final HistoricoLances historico;
    private final ObterEstado obterEstado;
    private final TransmissorSse transmissor;

    public ConsultaController(ListagemLeiloes listagem, HistoricoLances historico, ObterEstado obterEstado,
                              TransmissorSse transmissor) {
        this.listagem = listagem;
        this.historico = historico;
        this.obterEstado = obterEstado;
        this.transmissor = transmissor;
    }

    @GetMapping("/leiloes")
    public List<LeilaoResumo> listar(@RequestParam(required = false) String status) {
        return listagem.listar(status);
    }

    /**
     * Estado do leilão pelo cache. Com ?versaoMinima=N, garante uma resposta com pelo menos a
     * versão N (ex.: a que o POST do lance devolveu); sem ele, aceita a cópia que houver no Redis.
     */
    @GetMapping("/leiloes/{id}")
    public LeilaoDetalhe buscar(@PathVariable UUID id, @RequestParam(defaultValue = "0") int versaoMinima) {
        return obterEstado.obterParaConsulta(id, versaoMinima)
                .map(estado -> LeilaoDetalhe.de(id, estado))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leilão não encontrado"));
    }

    /** Conexão SSE: o navegador fica ouvindo e recebe o estado do leilão a cada mudança. */
    @GetMapping(path = "/leiloes/{id}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter acompanhar(@PathVariable UUID id) {
        return transmissor.assinar(id);
    }

    @GetMapping("/leiloes/{id}/lances")
    public List<Lance> lances(@PathVariable UUID id) {
        return historico.doLeilao(id);
    }

    @GetMapping("/licitantes/{id}/lances")
    public List<Atividade> atividade(@PathVariable String id) {
        return historico.doLicitante(id);
    }
}
