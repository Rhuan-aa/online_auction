package br.edu.ifsp.leilao.escrita.application;

import java.util.UUID;

public class LeilaoNaoEncontradoException extends RuntimeException {

    public LeilaoNaoEncontradoException(UUID leilaoId) {
        super("Leilão " + leilaoId + " não encontrado");
    }
}
