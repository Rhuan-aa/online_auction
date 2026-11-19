package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LeiturasDesatualizadasTest {
    private static final long MS = 1_000_000L;

    @Test
    void contaSoAsQueViramVersaoMenorQueAConfirmada() {
        LeiturasDesatualizadas d = new LeiturasDesatualizadas();
        d.registrar(5, 5, 0);
        d.registrar(6, 5, 0);
        d.registrar(3, 5, 10);
        d.registrar(4, 5, 20);
        LeiturasDesatualizadas.Resumo r = d.resumo();
        assertEquals(4, r.consultas());
        assertEquals(2, r.desatualizadas());
        assertEquals(50.0, r.pctDesatualizadas());
        assertEquals(1.5, r.atrasoMedioVersoes());
        assertEquals(15.0, r.atrasoMedioMs());
    }

    @Test
    void semConsultasTudoZero() {
        LeiturasDesatualizadas.Resumo r = new LeiturasDesatualizadas().resumo();
        assertEquals(0, r.consultas());
        assertEquals(0.0, r.pctDesatualizadas());
        assertEquals(0.0, r.atrasoMedioMs());
    }

    @Test
    void atrasoEmMsContaDesdeAConfirmacaoDaVersaoSeguinteALida() {
        Confirmacoes c = new Confirmacoes(10, 1, 100 * MS);
        c.confirmar(2, 110 * MS);
        c.confirmar(3, 130 * MS);
        assertEquals(3, c.ultima());

        assertEquals(40.0, c.atrasoMs(1, 3, 150 * MS), 1e-9);

        assertEquals(20.0, c.atrasoMs(2, 3, 150 * MS), 1e-9);
        assertEquals(0.0, c.atrasoMs(3, 3, 150 * MS), 1e-9);
    }

    @Test
    void versaoConfirmadaForaDeOrdemUsaAUltima() {
        Confirmacoes c = new Confirmacoes(10, 1, 0);
        c.confirmar(3, 50 * MS);
        assertEquals(3, c.ultima());
        assertEquals(10.0, c.atrasoMs(1, 3, 60 * MS), 1e-9);
        c.confirmar(2, 70 * MS);
        assertEquals(3, c.ultima(), "a última não volta para trás");
    }

    @Test
    void mesmaVersaoConfirmadaDuasVezesGuardaAPrimeira() {
        Confirmacoes c = new Confirmacoes(10, 1, 0);
        c.confirmar(2, 10 * MS);
        c.confirmar(2, 40 * MS);
        assertEquals(50.0, c.atrasoMs(1, 2, 60 * MS), 1e-9);
    }
}
