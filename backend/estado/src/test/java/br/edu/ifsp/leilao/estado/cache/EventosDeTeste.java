package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import java.time.Instant;
import java.util.List;

final class EventosDeTeste {
    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final Instant FIM = Instant.parse("2026-11-16T19:00:00Z");

    static final List<EventoLeilao> EVENTOS = List.of(
            new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM),
            new LeilaoIniciado(FIM),
            new LanceRegistrado("licitante-1", 10_000),
            new LanceRegistrado("licitante-2", 11_000),
            new LeilaoProrrogado(FIM.plusSeconds(30)),
            new LanceRegistrado("licitante-1", 12_000));

    private EventosDeTeste() {}
}
