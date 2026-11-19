package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.corrida.motor.Planejador.LancePlanejado;
import br.edu.ifsp.leilao.corrida.motor.Planejador.Plano;
import java.util.List;
import java.util.function.DoubleSupplier;
import org.junit.jupiter.api.Test;

class PlanejadorTest {
    private static double[] primeiros(long semente, int n) {
        DoubleSupplier r = Planejador.gerador(semente);
        double[] v = new double[n];
        for (int i = 0; i < n; i++) {
            v[i] = r.getAsDouble();
        }
        return v;
    }

    @Test
    void mulberry32IgualAoFront() {
        assertArrayEquals(new double[] {0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693},
                primeiros(42, 4), 0.0);
        assertArrayEquals(new double[] {0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741},
                primeiros(1, 4), 0.0);
        assertArrayEquals(new double[] {0.26642920868471265, 0.0003297457005828619, 0.2232720274478197, 0.1462021479383111},
                primeiros(0, 4), 0.0);
    }

    @Test
    void sementeUsaSo32BitsComoOJs() {
        assertArrayEquals(new double[] {0.43306733411736786, 0.32539576734416187}, primeiros(-7, 2), 0.0);
        assertEquals(0.6897749109193683, primeiros(4_294_967_296L + 5, 1)[0], 0.0);
        assertEquals(primeiros(5, 1)[0], primeiros(4_294_967_296L + 5, 1)[0], 0.0);
    }

    @Test
    void planoIgualAoFront() {
        Plano plano = Planejador.planejar(new Parametros(3, 2, 1, 0, 10_000, 100), 42);
        assertEquals(List.of(
                List.of(new LancePlanejado("licitante-1", 13_046, 3_046), new LancePlanejado("licitante-1", 15_343, 2_297)),
                List.of(new LancePlanejado("licitante-2", 14_277, 4_277), new LancePlanejado("licitante-2", 17_659, 3_382)),
                List.of(new LancePlanejado("licitante-3", 10_956, 956), new LancePlanejado("licitante-3", 13_636, 2_680))),
                plano.porLicitante());
        assertArrayEquals(new int[] {2, 1, 0}, plano.ordem());
    }

    @Test
    void passosFicamEntreIncrementoE50Vezes() {
        Plano plano = Planejador.planejar(new Parametros(20, 50, 1, 0, 10_000, 100), 7);
        for (List<LancePlanejado> lances : plano.porLicitante()) {
            for (LancePlanejado l : lances) {
                assertEquals(true, l.passo() >= 100 && l.passo() <= 5_000, "passo " + l.passo());
            }
        }
    }

    @Test
    void lanceAcompanhaOPreco() {
        LancePlanejado l = new LancePlanejado("licitante-1", 13_000, 300);
        assertEquals(13_000, Planejador.valorEnviado(l, 12_000));
        assertEquals(20_300, Planejador.valorEnviado(l, 20_000));
    }
}
