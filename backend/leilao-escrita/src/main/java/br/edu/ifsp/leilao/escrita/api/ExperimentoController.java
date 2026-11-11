package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.escrita.application.ServicoLeilao;
import br.edu.ifsp.leilao.escrita.domain.Leilao;
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

    record EstadoLeilao(UUID leilaoId, String titulo, Leilao.Status status, long precoAtual,
                        String liderId, Instant fimEm, int versao) {}

    private final ServicoLeilao servico;

    public ExperimentoController(ServicoLeilao servico) {
        this.servico = servico;
    }

    @GetMapping("/experimento/sem-cqrs/leiloes/{id}")
    public EstadoLeilao consultar(@PathVariable UUID id) {
        Leilao l = servico.consultar(id);
        return new EstadoLeilao(id, l.titulo(), l.status(), l.precoAtual(), l.liderId(), l.fimEm(), l.versao());
    }
}
