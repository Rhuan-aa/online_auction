package br.edu.ifsp.leilao.estado;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import java.time.Instant;
import java.util.List;

public record EstadoLeilao(Status status, String vendedorId, String titulo, long precoAtual,
                           long incrementoMinimo, String liderId, Instant inicioEm, Instant fimEm,
                           int versao) {

    public static final int SCHEMA_VERSION = 1;
    public enum Status { CRIADO, ABERTO, ENCERRADO, CANCELADO }
    public static final EstadoLeilao INICIAL =
            new EstadoLeilao(
                    null,
                    null,
                    null,
                    0,
                    0,
                    null,
                    null,
                    null,
                    0
            );

    public EstadoLeilao aplicarTodos(List<EventoLeilao> eventos) {
        EstadoLeilao estado = this;
        for (EventoLeilao evento : eventos) {
            estado = estado.aplicar(evento);
        }
        return estado;
    }

    public EstadoLeilao aplicar(EventoLeilao evento) {
        int proxima = versao + 1;
        return switch (evento) {
            case LeilaoCriado e -> new EstadoLeilao(Status.CRIADO, e.vendedorId(), e.titulo(),
                    e.precoInicial(), e.incrementoMinimo(), null, e.inicioEm(), e.fimEm(), proxima);
            case LeilaoIniciado e -> comStatus(Status.ABERTO, proxima);
            case LanceRegistrado e -> new EstadoLeilao(status, vendedorId, titulo, e.valor(),
                    incrementoMinimo, e.licitanteId(), inicioEm, fimEm, proxima);
            case LeilaoProrrogado e -> new EstadoLeilao(status, vendedorId, titulo, precoAtual,
                    incrementoMinimo, liderId, inicioEm, e.novoFimEm(), proxima);
            case LeilaoEncerrado e -> comStatus(Status.ENCERRADO, proxima);
            case LeilaoCancelado e -> comStatus(Status.CANCELADO, proxima);
        };
    }

    public boolean existe() {
        return versao > 0;
    }

    public boolean terminou() {
        return status == Status.ENCERRADO || status == Status.CANCELADO;
    }

    private EstadoLeilao comStatus(Status novo, int novaVersao) {
        return new EstadoLeilao(novo, vendedorId, titulo, precoAtual, incrementoMinimo, liderId,
                inicioEm, fimEm, novaVersao);
    }
}