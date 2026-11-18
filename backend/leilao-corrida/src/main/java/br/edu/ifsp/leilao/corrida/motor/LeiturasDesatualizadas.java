package br.edu.ifsp.leilao.corrida.motor;

/**
 * Conta as leituras desatualizadas: a consulta devolveu uma versão menor que a última versão já
 * confirmada a algum cliente no momento em que a consulta começou. O atraso médio (em versões e
 * em ms) é a média só entre as desatualizadas.
 */
public final class LeiturasDesatualizadas {

    public record Resumo(long consultas, long desatualizadas, double pctDesatualizadas,
                         double atrasoMedioVersoes, double atrasoMedioMs) {}

    private long consultas;
    private long desatualizadas;
    private long somaVersoes;
    private double somaMs;

    /** @param confirmada maior versão confirmada quando a leitura começou */
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
