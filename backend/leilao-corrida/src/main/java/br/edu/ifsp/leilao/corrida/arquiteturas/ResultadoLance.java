package br.edu.ifsp.leilao.corrida.arquiteturas;

public record ResultadoLance(Tipo tipo, int versaoBase, int versao, long precoAtual, int retentativas) {
    public enum Tipo { ACEITO, RECUSADO, CONFLITO }

    public static final int MAX_TENTATIVAS = 3;

    public boolean aceito() {
        return tipo == Tipo.ACEITO;
    }
}
