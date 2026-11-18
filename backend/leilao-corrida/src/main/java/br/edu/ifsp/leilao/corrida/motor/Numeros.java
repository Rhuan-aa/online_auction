package br.edu.ifsp.leilao.corrida.motor;

final class Numeros {

    private Numeros() {}

    /** Tempos e taxas do contrato: uma casa decimal. */
    static double umaCasa(double x) {
        return Double.isFinite(x) ? Math.round(x * 10.0) / 10.0 : 0.0;
    }

    static Double umaCasa(Double x) {
        return x == null ? null : umaCasa(x.doubleValue());
    }
}
