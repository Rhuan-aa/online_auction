package br.edu.ifsp.leilao.corrida.arquiteturas;

/**
 * O que a arquitetura respondeu ao lance.
 *
 * @param versaoBase versão do estado sobre o qual a decisão foi tomada (na última tentativa)
 * @param versao     aceito: a versão nova; recusado/conflito: a versão que a arquitetura viu
 * @param precoAtual preço depois da decisão (o do lance, se aceito)
 * @param retentativas quantas vezes tentou de novo por conflito de versão
 */
public record ResultadoLance(Tipo tipo, int versaoBase, int versao, long precoAtual, int retentativas) {

    public enum Tipo { ACEITO, RECUSADO, CONFLITO }

    /** Tentativas por lance nas arquiteturas com controle otimista; depois disso, conflito. */
    public static final int MAX_TENTATIVAS = 3;

    public boolean aceito() {
        return tipo == Tipo.ACEITO;
    }
}
