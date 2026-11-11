package br.edu.ifsp.leilao.escrita.domain;

/** Uma regra do leilão foi violada. O código vai para a API (ex.: LANCE_ABAIXO_DO_MINIMO). */
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
