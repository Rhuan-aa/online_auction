package br.edu.ifsp.leilao.escrita.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Regras do leilão, sem banco nem Kafka. O "agora" é passado como parâmetro: testa o tempo sem sleep. */
class LeilaoTest {

    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final Instant FIM = Instant.parse("2026-11-16T19:00:00Z");
    static final Instant DURANTE = Instant.parse("2026-11-16T18:30:00Z");

    /** Leilão aberto: preço inicial R$ 100,00, incremento R$ 10,00 (centavos). */
    static List<EventoLeilao> aberto(EventoLeilao... depois) {
        List<EventoLeilao> eventos = new ArrayList<>(List.of(
                new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM),
                new LeilaoIniciado(FIM)));
        eventos.addAll(List.of(depois));
        return eventos;
    }

    static String codigoDoErro(Runnable acao) {
        return assertThrows(RegraVioladaException.class, acao::run).codigo();
    }

    @Test
    void criarLeilaoValidoGeraLeilaoCriado() {
        assertEquals(List.of(new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM)),
                Leilao.criar("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM));
    }

    @Test
    void criarComFimAntesDoInicioEhInvalido() {
        assertEquals("LEILAO_INVALIDO",
                codigoDoErro(() -> Leilao.criar("vendedor-1", "Notebook", 10_000, 1_000, FIM, INICIO)));
    }

    @Test
    void primeiroLancePodeSerIgualAoPrecoInicial() {
        Leilao leilao = Leilao.reconstituir(aberto());
        assertEquals(List.of(new LanceRegistrado("licitante-1", 10_000)),
                leilao.darLance("licitante-1", 10_000, DURANTE));
    }

    @Test
    void lanceAbaixoDoAtualMaisIncrementoEhRecusado() {
        Leilao leilao = Leilao.reconstituir(aberto(new LanceRegistrado("licitante-1", 12_000)));
        // mínimo = 12.000 + 1.000 = 13.000
        assertEquals("LANCE_ABAIXO_DO_MINIMO", codigoDoErro(() -> leilao.darLance("licitante-2", 12_500, DURANTE)));
        assertEquals(List.of(new LanceRegistrado("licitante-2", 13_000)),
                leilao.darLance("licitante-2", 13_000, DURANTE));
    }

    @Test
    void vendedorNaoPodeDarLance() {
        Leilao leilao = Leilao.reconstituir(aberto());
        assertEquals("VENDEDOR_NAO_PODE_DAR_LANCE", codigoDoErro(() -> leilao.darLance("vendedor-1", 50_000, DURANTE)));
    }

    @Test
    void leilaoQueNaoAbriuRecusaLance() {
        Leilao leilao = Leilao.reconstituir(List.of(new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM)));
        assertEquals("LEILAO_NAO_ABERTO", codigoDoErro(() -> leilao.darLance("licitante-1", 10_000, DURANTE)));
    }

    @Test
    void lanceNosUltimos30SegundosProrrogaOPrazo() {
        Leilao leilao = Leilao.reconstituir(aberto());
        Instant faltando10s = FIM.minusSeconds(10);
        assertEquals(List.of(new LanceRegistrado("licitante-1", 10_000), new LeilaoProrrogado(FIM.plusSeconds(30))),
                leilao.darLance("licitante-1", 10_000, faltando10s));
    }

    @Test
    void leilaoComLancesNaoPodeSerCancelado() {
        Leilao leilao = Leilao.reconstituir(aberto(new LanceRegistrado("licitante-1", 10_000)));
        assertEquals("LEILAO_COM_LANCES", codigoDoErro(() -> leilao.cancelar("desisti")));
    }

    @Test
    void leilaoSemLancesPodeSerCancelado() {
        assertEquals(List.of(new LeilaoCancelado("desisti")), Leilao.reconstituir(aberto()).cancelar("desisti"));
    }

    @Test
    void encerrarSemLancesNaoTemVencedor() {
        assertEquals(List.of(new LeilaoEncerrado(null, null)), Leilao.reconstituir(aberto()).encerrar(FIM));
    }

    @Test
    void encerrarComLancesTemVencedor() {
        Leilao leilao = Leilao.reconstituir(aberto(new LanceRegistrado("licitante-2", 15_000)));
        assertEquals(List.of(new LeilaoEncerrado("licitante-2", 15_000L)), leilao.encerrar(FIM));
    }

    @Test
    void encerrarAntesDoPrazoNaoFazNada() {
        assertEquals(List.of(), Leilao.reconstituir(aberto()).encerrar(DURANTE));
    }

    @Test
    void iniciarDuasVezesNaoRepeteOEvento() {
        Leilao leilao = Leilao.reconstituir(aberto());
        assertEquals(List.of(), leilao.iniciar(DURANTE));
    }

    @Test
    void versaoEhONumeroDeEventosAplicados() {
        Leilao leilao = Leilao.reconstituir(aberto(new LanceRegistrado("licitante-1", 10_000)));
        assertEquals(3, leilao.versao());
        assertEquals("licitante-1", leilao.liderId());
    }
}
