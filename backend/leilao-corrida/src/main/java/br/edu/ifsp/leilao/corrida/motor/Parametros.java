package br.edu.ifsp.leilao.corrida.motor;

/** Parâmetros da corrida, como o contrato manda (dinheiro em centavos). */
public record Parametros(int licitantes, int lancesPorLicitante, int simultaneos, int leitores,
                         long precoInicial, long incremento) {

    public int totalLances() {
        return licitantes * lancesPorLicitante;
    }

    /** Maior passo sorteado por lance: 50 incrementos. */
    public long incrementoMaximo() {
        return incremento * 50;
    }
}
