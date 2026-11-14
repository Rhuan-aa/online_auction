package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.escrita.application.ServicoLeilao;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import java.time.Instant;
import java.util.UUID;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * SÓ PARA O PAINEL DE ADM: consulta "sem CQRS", reconstituindo o leilão a partir de todos
 * os eventos a cada chamada. Serve para comparar com a leitura pela projeção (com CQRS).
 */
@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class ExperimentoController {

    record Resposta(UUID leilaoId, String titulo, EstadoLeilao.Status status, long precoAtual,
                    String liderId, Instant fimEm, int versao) {}

    private final ServicoLeilao servico;

    public ExperimentoController(ServicoLeilao servico) {
        this.servico = servico;
    }

    @GetMapping("/experimento/sem-cqrs/leiloes/{id}")
    public Resposta consultar(@PathVariable UUID id) {
        EstadoLeilao e = servico.consultar(id);
        return new Resposta(id, e.titulo(), e.status(), e.precoAtual(), e.liderId(), e.fimEm(), e.versao());
    }
}