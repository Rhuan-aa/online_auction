package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.estado.LeitorEventos;
import br.edu.ifsp.leilao.estado.LeitorEventos.EventoGravado;
import br.edu.ifsp.leilao.estado.ObterEstado;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances.Atividade;
import br.edu.ifsp.leilao.leitura.consultas.HistoricoLances.Lance;
import br.edu.ifsp.leilao.leitura.consultas.ListagemLeiloes;
import br.edu.ifsp.leilao.leitura.consultas.ListagemLeiloes.LeilaoResumo;
import br.edu.ifsp.leilao.leitura.consultas.ViagemNoTempo;
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

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class ConsultaController {
    private final ListagemLeiloes listagem;
    private final HistoricoLances historico;
    private final ObterEstado obterEstado;
    private final TransmissorSse transmissor;
    private final ViagemNoTempo viagem;
    private final LeitorEventos eventos;

    public ConsultaController(ListagemLeiloes listagem, HistoricoLances historico, ObterEstado obterEstado,
                              TransmissorSse transmissor, ViagemNoTempo viagem, LeitorEventos eventos) {
        this.listagem = listagem;
        this.historico = historico;
        this.obterEstado = obterEstado;
        this.transmissor = transmissor;
        this.viagem = viagem;
        this.eventos = eventos;
    }

    @GetMapping("/leiloes")
    public List<LeilaoResumo> listar(@RequestParam(required = false) String status) {
        return listagem.listar(status);
    }

    @GetMapping("/leiloes/{id}")
    public LeilaoDetalhe buscar(@PathVariable UUID id, @RequestParam(defaultValue = "0") int versaoMinima,
                                @RequestParam(required = false) Integer ateVersao) {
        if (ateVersao != null) {
            return naVersao(id, ateVersao);
        }
        return obterEstado.obterParaConsulta(id, versaoMinima)
                .map(estado -> LeilaoDetalhe.de(id, estado))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Leilão não encontrado"));
    }

    private LeilaoDetalhe naVersao(UUID id, int ateVersao) {
        if (ateVersao < 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ateVersao deve ser >= 1");
        }
        return viagem.estadoNaVersao(id, ateVersao)
                .map(estado -> LeilaoDetalhe.de(id, estado))
                .orElseThrow(() -> viagem.existe(id)
                        ? new ResponseStatusException(HttpStatus.BAD_REQUEST, "O leilão não tem a versão " + ateVersao)
                        : new ResponseStatusException(HttpStatus.NOT_FOUND, "Leilão não encontrado"));
    }

    @GetMapping("/leiloes/{id}/eventos")
    public List<EventoGravado> eventos(@PathVariable UUID id) {
        List<EventoGravado> lista = eventos.todos(id);
        if (lista.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Leilão não encontrado");
        }
        return lista;
    }

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
