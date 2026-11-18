package br.edu.ifsp.leilao.corrida.arquiteturas;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import org.junit.jupiter.api.Test;

class CopiaRedisTest {

    @Test
    void codificaComAVersaoNaFrenteParaOScriptComparar() {
        EstadoLeilao e = EstadoLeilao.criado(10_000, 100).comLance("licitante-7", 12_300);
        String s = CopiaRedis.codificar(e);
        assertEquals("2|12300|licitante-7|10000|100", s);
        assertEquals(e, CopiaRedis.decodificar(s));
    }

    @Test
    void semLiderVoltaNull() {
        EstadoLeilao e = EstadoLeilao.criado(10_000, 100);
        assertEquals(e, CopiaRedis.decodificar(CopiaRedis.codificar(e)));
    }
}
