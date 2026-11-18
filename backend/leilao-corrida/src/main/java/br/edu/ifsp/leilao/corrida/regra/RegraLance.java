package br.edu.ifsp.leilao.corrida.regra;

/**
 * A regra do lance, a mesma nas 6 arquiteturas (função pura, sem banco nem relógio).
 *
 * <p>Aceito se o leilão está aberto e {@code valor >= preçoAtual + incremento}. No primeiro lance
 * ainda não há preço atual: o mínimo é {@code preçoInicial + incremento}. Na corrida não há
 * prorrogação nem encerramento.
 */
public final class RegraLance {

    private RegraLance() {}

    /** Menor valor aceito agora. */
    public static long minimo(EstadoLeilao estado) {
        long base = estado.temLance() ? estado.precoAtual() : estado.precoInicial();
        return Math.addExact(base, estado.incremento());
    }

    public static boolean aceita(EstadoLeilao estado, long valor) {
        return estado.aberto() && valor >= minimo(estado);
    }
}
