package br.edu.ifsp.leilao.escrita.application;

import java.util.UUID;

/** Outro comando gravou a mesma versão do leilão primeiro (dois lances ao mesmo tempo). */
public class ConflitoDeVersaoException extends RuntimeException {

    public ConflitoDeVersaoException(UUID leilaoId, int versao) {
        super("A versão " + versao + " do leilão " + leilaoId + " já foi gravada por outro comando");
    }
}
