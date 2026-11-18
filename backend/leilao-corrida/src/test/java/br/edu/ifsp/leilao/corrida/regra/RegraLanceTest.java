package br.edu.ifsp.leilao.corrida.regra;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RegraLanceTest {

    private final EstadoLeilao criado = EstadoLeilao.criado(10_000, 100);

    @Test
    void primeiroLanceExigePrecoInicialMaisIncremento() {
        assertEquals(10_100, RegraLance.minimo(criado));
        assertFalse(RegraLance.aceita(criado, 10_099));
        assertTrue(RegraLance.aceita(criado, 10_100));
        assertFalse(RegraLance.aceita(criado, 10_000), "igual ao preço inicial não basta");
    }

    @Test
    void depoisExigePrecoAtualMaisIncremento() {
        EstadoLeilao comLance = criado.comLance("licitante-1", 12_000);
        assertEquals(12_100, RegraLance.minimo(comLance));
        assertFalse(RegraLance.aceita(comLance, 12_099));
        assertTrue(RegraLance.aceita(comLance, 12_100));
        assertTrue(RegraLance.aceita(comLance, 50_000));
    }

    @Test
    void leilaoFechadoRecusaTudo() {
        EstadoLeilao fechado = new EstadoLeilao(10_000, 100, 10_000, null, 1, false);
        assertFalse(RegraLance.aceita(fechado, 1_000_000));
    }

    @Test
    void comLanceSobeVersaoEtrocaLider() {
        EstadoLeilao novo = criado.comLance("licitante-2", 10_500);
        assertEquals(2, novo.versao());
        assertEquals("licitante-2", novo.lider());
        assertEquals(10_500, novo.precoAtual());
        assertNull(criado.lider());
        assertEquals(1, criado.versao(), "estado é imutável");
    }

    @Test
    void replayUsaAVersaoDoEvento() {
        EstadoLeilao e = criado.aplicarLance("licitante-1", 10_200, 2).aplicarLance("licitante-3", 10_400, 3);
        assertEquals(3, e.versao());
        assertEquals("licitante-3", e.lider());
        assertEquals(10_500, RegraLance.minimo(e));
    }
}
