package br.edu.ifsp.leilao.escrita.domain;

public class RegraVioladaException extends RuntimeException {
    private final String codigo;

    public RegraVioladaException(String codigo, String mensagem) {
        super(mensagem);
        this.codigo = codigo;
    }

    public String codigo() {
        return codigo;
    }
}
