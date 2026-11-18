package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.corrida.motor.Integridade.LanceAceito;
import java.util.List;
import org.junit.jupiter.api.Test;

class IntegridadeTest {

    @Test
    void semConcorrenciaNadaSePerde() {
        List<LanceAceito> aceitos = List.of(
                new LanceAceito("licitante-1", 10_100, 1, 2, 1),
                new LanceAceito("licitante-2", 10_300, 2, 3, 2),
                new LanceAceito("licitante-1", 10_500, 3, 4, 3));
        Integridade.Resultado r = Integridade.avaliar(aceitos, 10_000, 10_500, "licitante-1");
        assertTrue(r.ok());
        assertTrue(r.umVencedor());
        assertTrue(r.precoFinalCorreto());
        assertEquals(0, r.lancesPerdidos());
    }

    @Test
    void lostUpdateMenorPorCimaPerdeOMaior() {
        // A e B leram a v1; A gravou 12_000, depois B gravou 11_000 por cima.
        List<LanceAceito> aceitos = List.of(
                new LanceAceito("A", 12_000, 1, 2, 1),
                new LanceAceito("B", 11_000, 1, 2, 2));
        Integridade.Resultado r = Integridade.avaliar(aceitos, 10_000, 11_000, "B");
        assertFalse(r.ok());
        assertFalse(r.precoFinalCorreto(), "o maior aceito foi 12_000");
        assertFalse(r.umVencedor(), "o líder deveria ser A");
        assertEquals(1, r.lancesPerdidos(), "A conta uma vez só (acima do final e mesma base)");
    }

    @Test
    void lostUpdateMaiorPorCimaAindaPerdeUm() {
        // Mesmo com o preço final certo, o lance de A sumiu: os dois foram decididos sobre a v1.
        List<LanceAceito> aceitos = List.of(
                new LanceAceito("A", 11_000, 1, 2, 1),
                new LanceAceito("B", 12_000, 1, 2, 2));
        Integridade.Resultado r = Integridade.avaliar(aceitos, 10_000, 12_000, "B");
        assertTrue(r.precoFinalCorreto());
        assertTrue(r.umVencedor());
        assertEquals(1, r.lancesPerdidos());
        assertFalse(r.ok());
    }

    @Test
    void grupoDeTresNaMesmaBasePerdeDois() {
        List<LanceAceito> aceitos = List.of(
                new LanceAceito("A", 11_000, 5, 6, 1),
                new LanceAceito("B", 11_500, 5, 6, 2),
                new LanceAceito("C", 12_000, 5, 6, 3),
                new LanceAceito("D", 12_500, 6, 7, 4));
        assertEquals(2, Integridade.lancesPerdidos(aceitos, 12_500));
    }

    @Test
    void valorAcimaDoFinalSemBaseRepetidaTambemEPerdido() {
        List<LanceAceito> aceitos = List.of(
                new LanceAceito("A", 15_000, 1, 2, 1),
                new LanceAceito("B", 12_000, 2, 3, 2));
        assertEquals(1, Integridade.lancesPerdidos(aceitos, 12_000));
    }

    @Test
    void semLancesOPrecoFicaOInicialSemLider() {
        assertTrue(Integridade.avaliar(List.of(), 10_000, 10_000, null).ok());
        assertFalse(Integridade.avaliar(List.of(), 10_000, 10_000, "X").umVencedor());
    }
}
