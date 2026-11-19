package br.edu.ifsp.leilao.corrida.motor;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

public final class Curva {
    public static final int LARGURA = 10;

    public record Ponto(int versao, double ms) {}

    private double[] somas = new double[16];
    private long[] contagens = new long[16];

    static int faixa(int versao) {
        return (Math.max(1, versao) - 1) / LARGURA;
    }

    public synchronized void registrar(int versao, double ms) {
        int f = faixa(versao);
        if (f >= somas.length) {
            int tamanho = Math.max(f + 1, somas.length * 2);
            somas = Arrays.copyOf(somas, tamanho);
            contagens = Arrays.copyOf(contagens, tamanho);
        }
        somas[f] += ms;
        contagens[f]++;
    }

    public synchronized List<Ponto> pontos() {
        List<Ponto> pontos = new ArrayList<>();
        for (int f = 0; f < somas.length; f++) {
            if (contagens[f] > 0) {
                pontos.add(new Ponto((f + 1) * LARGURA, Numeros.umaCasa(somas[f] / contagens[f])));
            }
        }
        return pontos;
    }
}
