package br.edu.ifsp.leilao.estado;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class EstadoLeilaoTest {

    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final Instant FIM = Instant.parse("2026-11-16T19:00:00Z");

    static final List<EventoLeilao> EVENTOS = List.of(
            new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM),
            new LeilaoIniciado(FIM),
            new LanceRegistrado("licitante-1", 10_000),
            new LanceRegistrado("licitante-2", 11_000),
            new LeilaoProrrogado(FIM.plusSeconds(30)),
            new LanceRegistrado("licitante-1", 12_000));

    @Test
    void versaoEhONumeroDeEventosAplicados() {
        assertEquals(6, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS).versao());
        assertFalse(EstadoLeilao.INICIAL.existe());
    }

    @Test
    void continuarDeUmaCopiaDaOMesmoResultadoQueRelerTudo() {
        EstadoLeilao relendoTudo = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS);

        EstadoLeilao copia = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3));
        List<EventoLeilao> posteriores = EVENTOS.subList(copia.versao(), EVENTOS.size());
        assertEquals(relendoTudo, copia.aplicarTodos(posteriores));
    }

    @Test
    void lanceMudaPrecoELiderEProrrogacaoMudaOFim() {
        EstadoLeilao estado = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS);
        assertEquals(EstadoLeilao.Status.ABERTO, estado.status());
        assertEquals(12_000, estado.precoAtual());
        assertEquals("licitante-1", estado.liderId());
        assertEquals(FIM.plusSeconds(30), estado.fimEm());
    }
}