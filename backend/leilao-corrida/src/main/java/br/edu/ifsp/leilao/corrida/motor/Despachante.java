package br.edu.ifsp.leilao.corrida.motor;

import br.edu.ifsp.leilao.corrida.motor.Planejador.LancePlanejado;
import br.edu.ifsp.leilao.corrida.motor.Planejador.Plano;

final class Despachante {
    record Vez(int licitante, LancePlanejado lance) {}

    private final Plano plano;
    private final int[] proximo;
    private final boolean[] ocupado;
    private int cursor;

    Despachante(Plano plano) {
        this.plano = plano;
        this.proximo = new int[plano.porLicitante().size()];
        this.ocupado = new boolean[plano.porLicitante().size()];
    }

    synchronized Vez escolher() {
        int[] ordem = plano.ordem();
        for (int passo = 0; passo < ordem.length; passo++) {
            int i = ordem[(cursor + passo) % ordem.length];
            if (!ocupado[i] && proximo[i] < plano.porLicitante().get(i).size()) {
                cursor = (cursor + passo + 1) % ordem.length;
                ocupado[i] = true;
                return new Vez(i, plano.porLicitante().get(i).get(proximo[i]++));
            }
        }
        return null;
    }

    synchronized void liberar(int licitante) {
        ocupado[licitante] = false;
    }
}
