package br.edu.ifsp.leilao.estado;

public enum Configuracao {
    A,

    B,

    C;

    public boolean usaRedis() {
        return this == C;
    }

    public boolean usaCheckpoint() {
        return this != A;
    }
}
