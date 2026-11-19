package br.edu.ifsp.leilao.escrita.application;

import java.util.UUID;

public class ConflitoDeVersaoException extends RuntimeException {
    private final int tentativas;

    public ConflitoDeVersaoException(UUID leilaoId, int versao) {
        super("A versão " + versao + " do leilão " + leilaoId + " já foi gravada por outro comando");
        this.tentativas = 1;
    }

    public ConflitoDeVersaoException(ConflitoDeVersaoException ultimo, int tentativas) {
        super(ultimo.getMessage(), ultimo);
        this.tentativas = tentativas;
    }

    public int tentativas() {
        return tentativas;
    }
}
