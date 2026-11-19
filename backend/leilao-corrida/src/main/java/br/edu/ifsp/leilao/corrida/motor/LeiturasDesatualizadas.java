package br.edu.ifsp.leilao.corrida.motor;

public final class LeiturasDesatualizadas {
    public record Resumo(long consultas, long desatualizadas, double pctDesatualizadas,
                         double atrasoMedioVersoes, double atrasoMedioMs) {}

    private long consultas;
    private long desatualizadas;
    private long somaVersoes;
    private double somaMs;

    public synchronized void registrar(int versaoLida, int confirmada, double atrasoMs) {
        consultas++;
        if (versaoLida < confirmada) {
            desatualizadas++;
            somaVersoes += confirmada - versaoLida;
            somaMs += atrasoMs;
        }
    }

    public synchronized Resumo resumo() {
        return new Resumo(consultas, desatualizadas,
                consultas == 0 ? 0 : Numeros.umaCasa(100.0 * desatualizadas / consultas),
                desatualizadas == 0 ? 0 : Numeros.umaCasa((double) somaVersoes / desatualizadas),
                desatualizadas == 0 ? 0 : Numeros.umaCasa(somaMs / desatualizadas));
    }
}
