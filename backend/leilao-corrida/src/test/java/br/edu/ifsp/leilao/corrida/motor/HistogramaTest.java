package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Random;
import org.junit.jupiter.api.Test;

class HistogramaTest {

    /** Percentil pelo posto mais próximo, igual ao {@code percentil} do front. */
    private static double referencia(double[] valores, double p) {
        double[] o = valores.clone();
        Arrays.sort(o);
        int posto = (int) Math.max(1, Math.ceil(p / 100 * o.length));
        return o[posto - 1];
    }

    @Test
    void semAmostrasDevolveNull() {
        assertNull(new Histograma().percentil(50));
        assertEquals(0, new Histograma().amostras());
    }

    @Test
    void postoMaisProximoExatoAbaixoDe128Microssegundos() {
        Histograma h = new Histograma();
        for (int i = 1; i <= 100; i++) {
            h.registrar(i / 1000.0); // 1..100 µs
        }
        assertEquals(100, h.amostras());
        assertEquals(0.050, h.percentil(50), 1e-12);
        assertEquals(0.095, h.percentil(95), 1e-12);
        assertEquals(0.001, h.percentil(0), 1e-12);
        assertEquals(0.100, h.percentil(100), 1e-12);
    }

    @Test
    void erroRelativoMenorQue1PorCento() {
        Random r = new Random(1);
        double[] valores = new double[5_000];
        Histograma h = new Histograma();
        for (int i = 0; i < valores.length; i++) {
            valores[i] = 0.2 + r.nextDouble() * 400; // 0,2 ms a 400 ms
            h.registrar(valores[i]);
        }
        for (double p : new double[] {50, 95, 99}) {
            double esperado = referencia(valores, p);
            double obtido = h.percentil(p);
            assertTrue(Math.abs(obtido - esperado) / esperado < 0.01, "p" + p + ": " + obtido + " vs " + esperado);
        }
    }

    @Test
    void faixasSaoContiguasEMonotonas() {
        int anterior = -1;
        for (long us = 0; us < 2_000_000; us++) {
            int i = Histograma.indice(us);
            assertTrue(i >= anterior);
            assertTrue(i - anterior <= 1, "pulo em " + us);
            anterior = i;
            double rep = Histograma.representante(i);
            assertTrue(Math.abs(rep - us) <= Math.max(0.5, us / 128.0), "us=" + us + " rep=" + rep);
        }
    }
}
