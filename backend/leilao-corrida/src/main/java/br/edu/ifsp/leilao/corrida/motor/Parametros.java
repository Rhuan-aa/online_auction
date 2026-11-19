package br.edu.ifsp.leilao.corrida.motor;

public record Parametros(int licitantes, int lancesPorLicitante, int simultaneos, int leitores,
                         long precoInicial, long incremento) {
    public int totalLances() {
        return licitantes * lancesPorLicitante;
    }

    public long incrementoMaximo() {
        return incremento * 50;
    }
}
