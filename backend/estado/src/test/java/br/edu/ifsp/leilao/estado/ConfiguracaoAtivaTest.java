package br.edu.ifsp.leilao.estado;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class ConfiguracaoAtivaTest {

    @Test
    void comecaNaInicialETroca() {
        var c = new ConfiguracaoAtiva(Configuracao.C);
        assertEquals(Configuracao.C, c.atual());
        assertEquals(Configuracao.A, c.trocar(Configuracao.A));
        assertEquals(Configuracao.A, c.atual());
    }
}
