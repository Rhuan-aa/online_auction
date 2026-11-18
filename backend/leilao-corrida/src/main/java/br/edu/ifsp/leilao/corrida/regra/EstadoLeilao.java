package br.edu.ifsp.leilao.corrida.regra;

/**
 * Estado do leilão da corrida. Versão 1 = leilão criado; cada lance aceito soma 1.
 * Sem lance, {@code precoAtual} é o preço inicial e {@code lider} é null.
 */
public record EstadoLeilao(long precoInicial, long incremento, long precoAtual, String lider, int versao,
                           boolean aberto) {

    public static EstadoLeilao criado(long precoInicial, long incremento) {
        return new EstadoLeilao(precoInicial, incremento, precoInicial, null, 1, true);
    }

    public boolean temLance() {
        return lider != null;
    }

    /** Estado depois de um lance aceito (não confere a regra: quem chama já conferiu). */
    public EstadoLeilao comLance(String licitante, long valor) {
        return new EstadoLeilao(precoInicial, incremento, valor, licitante, versao + 1, aberto);
    }

    /** Aplica um lance já gravado (replay de eventos), com a versão que ele tem no banco. */
    public EstadoLeilao aplicarLance(String licitante, long valor, int versaoDoEvento) {
        return new EstadoLeilao(precoInicial, incremento, valor, licitante, versaoDoEvento, aberto);
    }
}
