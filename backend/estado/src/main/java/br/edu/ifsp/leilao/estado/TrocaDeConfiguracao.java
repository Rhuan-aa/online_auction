package br.edu.ifsp.leilao.estado;

import org.springframework.stereotype.Component;

/**
 * Troca a configuração A/B/C em tempo de execução sem deixar o Redis desatualizado.
 *
 * Em A e B o cache não grava (nem o estado, nem o índice de abertos), mas o Redis continua com o que
 * tinha antes. Ao voltar para C, essas cópias velhas seriam confiadas pelas consultas sem
 * versaoMinima e pelo índice de abertos (que ainda teria o marcador "__completo__"): a listagem
 * poderia omitir leilões criados durante A/B ou mostrar leilões já encerrados. Por isso, ao passar
 * de uma configuração sem Redis para uma com Redis, apagamos tudo; o cache volta a se formar sozinho
 * (cache-aside), e a correção não depende da configuração.
 */
@Component
public class TrocaDeConfiguracao {

    private final ConfiguracaoAtiva configuracao;
    private final CacheEstadoLeilao cache;

    public TrocaDeConfiguracao(ConfiguracaoAtiva configuracao, CacheEstadoLeilao cache) {
        this.configuracao = configuracao;
        this.cache = cache;
    }

    /** Devolve a configuração em vigor depois da troca. Limpa o Redis só ao ligá-lo (A/B para C). */
    public Configuracao trocar(Configuracao nova) {
        boolean religaRedis = !configuracao.atual().usaRedis() && nova.usaRedis();
        Configuracao agora = configuracao.trocar(nova);
        if (religaRedis) {
            cache.apagarTudo(); // depois da troca: apagarTudo não depende da configuração
        }
        return agora;
    }
}
