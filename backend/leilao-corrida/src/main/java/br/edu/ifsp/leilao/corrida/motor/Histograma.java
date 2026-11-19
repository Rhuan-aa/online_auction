package br.edu.ifsp.leilao.corrida.motor;

import java.util.concurrent.atomic.AtomicLongArray;

public final class Histograma {
    private static final int EXATOS = 128;
    private static final int SUB = 64;
    private static final long MAX_US = (1L << 40) - 1;
    private static final int FAIXAS = indice(MAX_US) + 1;

    private final AtomicLongArray contagens = new AtomicLongArray(FAIXAS);

    static int indice(long us) {
        if (us < EXATOS) {
            return (int) Math.max(0, us);
        }
        int expoente = 63 - Long.numberOfLeadingZeros(us);
        int deslocamento = expoente - 6;
        int sub = (int) (us >>> deslocamento);
        return EXATOS + (deslocamento - 1) * SUB + (sub - SUB);
    }

    static double representante(int indice) {
        if (indice < EXATOS) {
            return indice;
        }
        int k = indice - EXATOS;
        int deslocamento = k / SUB + 1;
        long sub = k % SUB + SUB;
        long menor = sub << deslocamento;
        long maior = ((sub + 1) << deslocamento) - 1;
        return (menor + maior) / 2.0;
    }

    public void registrar(double ms) {
        long us = Math.min(MAX_US, Math.max(0, Math.round(ms * 1000)));
        contagens.incrementAndGet(indice(us));
    }

    public long amostras() {
        long total = 0;
        for (int i = 0; i < FAIXAS; i++) {
            total += contagens.get(i);
        }
        return total;
    }

    public Double percentil(double p) {
        long[] copia = new long[FAIXAS];
        long total = 0;
        for (int i = 0; i < FAIXAS; i++) {
            copia[i] = contagens.get(i);
            total += copia[i];
        }
        if (total == 0) {
            return null;
        }
        long posto = Math.max(1, (long) Math.ceil(p / 100.0 * total));
        long acumulado = 0;
        for (int i = 0; i < FAIXAS; i++) {
            acumulado += copia[i];
            if (acumulado >= posto) {
                return representante(i) / 1000.0;
            }
        }
        return representante(FAIXAS - 1) / 1000.0;
    }
}
