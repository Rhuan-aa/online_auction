package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class LeiturasDesatualizadasTest {

    private static final long MS = 1_000_000L;

    @Test
    void contaSoAsQueViramVersaoMenorQueAConfirmada() {
        LeiturasDesatualizadas d = new LeiturasDesatualizadas();
        d.registrar(5, 5, 0);   // em dia
        d.registrar(6, 5, 0);   // à frente (lance gravado, ainda não confirmado): em dia
        d.registrar(3, 5, 10);  // 2 versões atrás, 10 ms
        d.registrar(4, 5, 20);  // 1 versão atrás, 20 ms
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
        // Leu a v1 começando em 150 ms: a v2 existe desde 110 ms -> 40 ms de atraso.
        assertEquals(40.0, c.atrasoMs(1, 3, 150 * MS), 1e-9);
        // Leu a v2: a v3 existe desde 130 ms -> 20 ms.
        assertEquals(20.0, c.atrasoMs(2, 3, 150 * MS), 1e-9);
        assertEquals(0.0, c.atrasoMs(3, 3, 150 * MS), 1e-9);
    }

    @Test
    void versaoConfirmadaForaDeOrdemUsaAUltima() {
        Confirmacoes c = new Confirmacoes(10, 1, 0);
        c.confirmar(3, 50 * MS); // a v2 ainda não voltou ao cliente
        assertEquals(3, c.ultima());
        assertEquals(10.0, c.atrasoMs(1, 3, 60 * MS), 1e-9);
        c.confirmar(2, 70 * MS);
        assertEquals(3, c.ultima(), "a última não volta para trás");
    }

    @Test
    void mesmaVersaoConfirmadaDuasVezesGuardaAPrimeira() {
        Confirmacoes c = new Confirmacoes(10, 1, 0);
        c.confirmar(2, 10 * MS);
        c.confirmar(2, 40 * MS); // lost update no CRUD simples
        assertEquals(50.0, c.atrasoMs(1, 2, 60 * MS), 1e-9);
    }
}
