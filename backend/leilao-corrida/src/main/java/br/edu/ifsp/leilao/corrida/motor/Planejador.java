package br.edu.ifsp.leilao.corrida.motor;

import java.util.ArrayList;
import java.util.List;
import java.util.function.DoubleSupplier;

public final class Planejador {
    private Planejador() {}

    public record LancePlanejado(String licitanteId, long valor, long passo) {}

    public record Plano(List<List<LancePlanejado>> porLicitante, int[] ordem) {}

    public static DoubleSupplier gerador(long semente) {
        int[] a = {(int) semente};
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

    public static long valorEnviado(LancePlanejado lance, long precoConhecido) {
        return Math.max(lance.valor(), precoConhecido + lance.passo());
    }
}
