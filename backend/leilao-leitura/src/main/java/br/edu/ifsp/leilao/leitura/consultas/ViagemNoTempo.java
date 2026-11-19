package br.edu.ifsp.leilao.leitura.consultas;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ViagemNoTempo {
    private final LeitorEventos eventos;

    public ViagemNoTempo(LeitorEventos eventos) {
        this.eventos = eventos;
    }

    public Optional<EstadoLeilao> estadoNaVersao(UUID leilaoId, int n) {
        EstadoLeilao estado = EstadoLeilao.INICIAL.aplicarTodos(eventos.ateVersao(leilaoId, n));
        return n >= 1 && estado.versao() >= n ? Optional.of(estado) : Optional.empty();
    }

    public boolean existe(UUID leilaoId) {
        return !eventos.ateVersao(leilaoId, 1).isEmpty();
    }
}
