package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.escrita.domain.RegraVioladaException;

public class LanceRecusadoException extends RuntimeException {
    private final RegraVioladaException causa;
    private final int tentativas;

    public LanceRecusadoException(RegraVioladaException causa, int tentativas) {
        super(causa.getMessage(), causa);
        this.causa = causa;
        this.tentativas = tentativas;
    }

    public String codigo() {
        return causa.codigo();
    }

    public int tentativas() {
        return tentativas;
    }
}
