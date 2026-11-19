package br.edu.ifsp.leilao.corrida.regra;

public record EstadoLeilao(long precoInicial, long incremento, long precoAtual, String lider, int versao,
                           boolean aberto) {
    public static EstadoLeilao criado(long precoInicial, long incremento) {
        return new EstadoLeilao(precoInicial, incremento, precoInicial, null, 1, true);
    }

    public boolean temLance() {
        return lider != null;
    }

    public EstadoLeilao comLance(String licitante, long valor) {
        return new EstadoLeilao(precoInicial, incremento, valor, licitante, versao + 1, aberto);
    }

    public EstadoLeilao aplicarLance(String licitante, long valor, int versaoDoEvento) {
        return new EstadoLeilao(precoInicial, incremento, valor, licitante, versaoDoEvento, aberto);
    }
}
