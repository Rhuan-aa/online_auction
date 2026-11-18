package br.edu.ifsp.leilao.leitura.consultas;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Reconstrói o estado do leilão em qualquer versão passada, direto do Event Store.
 * Não passa por ObterEstado, cache nem checkpoint, e não registra métricas: é só leitura de auditoria.
 */
@Component
public class ViagemNoTempo {

    private final LeitorEventos eventos;

    public ViagemNoTempo(LeitorEventos eventos) {
        this.eventos = eventos;
    }

    /** Estado após os eventos 1..n; vazio se o leilão não tem n eventos. */
    public Optional<EstadoLeilao> estadoNaVersao(UUID leilaoId, int n) {
        EstadoLeilao estado = EstadoLeilao.INICIAL.aplicarTodos(eventos.ateVersao(leilaoId, n));
        return n >= 1 && estado.versao() >= n ? Optional.of(estado) : Optional.empty();
    }

    /** O leilão existe se tem ao menos o evento de versão 1. */
    public boolean existe(UUID leilaoId) {
        return !eventos.ateVersao(leilaoId, 1).isEmpty();
    }
}
