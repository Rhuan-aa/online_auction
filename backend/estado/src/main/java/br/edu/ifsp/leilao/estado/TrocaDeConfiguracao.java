package br.edu.ifsp.leilao.estado;

import org.springframework.stereotype.Component;

@Component
public class TrocaDeConfiguracao {
    private final ConfiguracaoAtiva configuracao;
    private final CacheEstadoLeilao cache;

    public TrocaDeConfiguracao(ConfiguracaoAtiva configuracao, CacheEstadoLeilao cache) {
        this.configuracao = configuracao;
        this.cache = cache;
    }

    public Configuracao trocar(Configuracao nova) {
        boolean religaRedis = !configuracao.atual().usaRedis() && nova.usaRedis();
        if (religaRedis) {
            cache.apagarTudo();
        }
        return configuracao.trocar(nova);
    }
}
