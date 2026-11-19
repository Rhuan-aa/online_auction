package br.edu.ifsp.leilao.corrida.motor;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLongArray;

public final class Confirmacoes {
    private final AtomicLongArray quando;
    private final AtomicInteger ultima = new AtomicInteger();

    public Confirmacoes(int maiorVersao, int versaoInicial, long agora) {
        this.quando = new AtomicLongArray(maiorVersao + 2);
        confirmar(versaoInicial, agora);
    }

    public void confirmar(int versao, long agora) {
        if (versao >= 0 && versao < quando.length()) {
            quando.compareAndSet(versao, 0L, agora == 0 ? 1 : agora);
        }
        ultima.accumulateAndGet(versao, Math::max);
    }

    public int ultima() {
        return ultima.get();
    }

    public double atrasoMs(int versaoLida, int confirmada, long inicioLeitura) {
        if (versaoLida >= confirmada) {
            return 0;
        }
        long t = tempo(versaoLida + 1);
        if (t == 0) {
            t = tempo(confirmada);
        }
        return t == 0 ? 0 : Math.max(0, inicioLeitura - t) / 1_000_000.0;
    }

    private long tempo(int versao) {
        return versao >= 0 && versao < quando.length() ? quando.get(versao) : 0;
    }
}
