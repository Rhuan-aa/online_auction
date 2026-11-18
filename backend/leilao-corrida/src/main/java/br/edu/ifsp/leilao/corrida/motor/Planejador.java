package br.edu.ifsp.leilao.corrida.motor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleSupplier;

/**
 * Plano de lances a partir de uma semente: porte fiel de {@code gerador} e {@code planejarLances}
 * de frontend/src/simulacao.ts (mesma semente, mesmos valores e mesma rotação). Os passos de cada
 * lance são sorteados em [incremento, incremento x 50].
 */
public final class Planejador {

    private Planejador() {}

    /** {@code passo} = incremento sorteado deste lance (valor = valor anterior do licitante + passo). */
    public record LancePlanejado(String licitanteId, long valor, long passo) {}

    /** Lances de cada licitante, em ordem crescente, e a rotação embaralhada em que são atendidos. */
    public record Plano(List<List<LancePlanejado>> porLicitante, int[] ordem) {}

    /**
     * mulberry32. Em JS, {@code Math.imul} e {@code >>> 0} trabalham em 32 bits; em Java a
     * aritmética de int já dá a volta do mesmo jeito, então basta usar int e tirar o sinal no fim.
     */
    public static DoubleSupplier gerador(long semente) {
        int[] a = {(int) semente}; // semente >>> 0: só os 32 bits de baixo importam
        return () -> {
            a[0] += 0x6d2b79f5;
            int t = a[0];
            t = (t ^ (t >>> 15)) * (t | 1);
            t ^= t + (t ^ (t >>> 7)) * (t | 61);
            return ((t ^ (t >>> 14)) & 0xffffffffL) / 4294967296.0;
        };
    }

    static long inteiroEntre(DoubleSupplier rand, long min, long max) {
        return min + (long) Math.floor(rand.getAsDouble() * (max - min + 1));
    }

    public static Plano planejar(Parametros p, long semente) {
        DoubleSupplier rand = gerador(semente);
        List<List<LancePlanejado>> porLicitante = new ArrayList<>(p.licitantes());
        for (int i = 0; i < p.licitantes(); i++) {
            String licitanteId = "licitante-" + (i + 1);
            long valor = p.precoInicial();
            List<LancePlanejado> lances = new ArrayList<>(p.lancesPorLicitante());
            for (int k = 0; k < p.lancesPorLicitante(); k++) {
                long passo = inteiroEntre(rand, p.incremento(), p.incrementoMaximo());
                valor += passo;
                lances.add(new LancePlanejado(licitanteId, valor, passo));
            }
            porLicitante.add(lances);
        }
        int[] ordem = new int[p.licitantes()];
        for (int i = 0; i < ordem.length; i++) {
            ordem[i] = i;
        }
        for (int i = ordem.length - 1; i > 0; i--) {
            int j = (int) Math.floor(rand.getAsDouble() * (i + 1));
            int t = ordem[i];
            ordem[i] = ordem[j];
            ordem[j] = t;
        }
        return new Plano(porLicitante, ordem);
    }

    /** Valor enviado: o lance "acompanha o preço" (maior entre o planejado e o último preço conhecido + passo). */
    public static long valorEnviado(LancePlanejado lance, long precoConhecido) {
        return Math.max(lance.valor(), precoConhecido + lance.passo());
    }
}
