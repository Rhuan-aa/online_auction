package br.edu.ifsp.leilao.corrida.regra;

public final class RegraLance {
    private RegraLance() {}

    public static long minimo(EstadoLeilao estado) {
        long base = estado.temLance() ? estado.precoAtual() : estado.precoInicial();
        return Math.addExact(base, estado.incremento());
    }

    public static boolean aceita(EstadoLeilao estado, long valor) {
        return estado.aberto() && valor >= minimo(estado);
    }
}
