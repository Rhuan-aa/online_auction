package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.contratos.CriarLeilaoRequest;
import br.edu.ifsp.leilao.contratos.DarLanceRequest;
import br.edu.ifsp.leilao.escrita.application.ServicoLeilao;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** API de comandos (PLANO.md, seção 2.4). Só traduz HTTP <-> ServicoLeilao. */
@RestController
@RequestMapping("/leiloes")
@CrossOrigin(origins = "http://localhost:5173")
public class LeilaoController {

    record LeilaoCriadoResponse(UUID leilaoId, int versao) {}
    record VersaoResponse(int versao) {}
    record CancelarRequest(String motivo) {}

    private final ServicoLeilao servico;

    public LeilaoController(ServicoLeilao servico) {
        this.servico = servico;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LeilaoCriadoResponse criar(@RequestBody CriarLeilaoRequest request) {
        return new LeilaoCriadoResponse(servico.criar(request), 1);
    }

    @PostMapping("/{id}/lances")
    public VersaoResponse darLance(@PathVariable UUID id, @RequestBody DarLanceRequest request) {
        return new VersaoResponse(servico.darLance(id, request.licitanteId(), request.valor()));
    }

    @PostMapping("/{id}/cancelar")
    public VersaoResponse cancelar(@PathVariable UUID id, @RequestBody CancelarRequest request) {
        return new VersaoResponse(servico.cancelar(id, request.motivo()));
    }
}
