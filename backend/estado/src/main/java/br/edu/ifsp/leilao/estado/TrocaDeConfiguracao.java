package br.edu.ifsp.leilao.estado;

import org.springframework.stereotype.Component;

/**
 * Troca a configuração A/B/C em tempo de execução sem deixar o Redis desatualizado.
 *
 * Em A e B o cache não grava (nem o estado, nem o índice de abertos), mas o Redis continua com o que
 * tinha antes. Ao voltar para C, essas cópias velhas seriam confiadas pelas consultas sem
 * versaoMinima e pelo índice de abertos (que ainda teria o marcador "__completo__"): a listagem
 * poderia omitir leilões criados durante A/B ou mostrar leilões já encerrados. Por isso, ao passar
 * de uma configuração sem Redis para uma com Redis, apagamos tudo ANTES de trocar; o cache volta a
 * se formar sozinho (cache-aside), e a correção não depende da configuração.
 *
 * Apagar antes é seguro porque, em A/B, nada grava no Redis, e evita uma janela em que um leitor
 * em C confiaria numa cópia velha. Se o Redis estiver fora do ar e apagarTudo falhar, a exceção
 * sobe e a configuração NÃO muda: ligar o Redis com cópias velhas violaria a correção.
 */
@Component
public class TrocaDeConfiguracao {

    private final ConfiguracaoAtiva configuracao;
    private final CacheEstadoLeilao cache;

    public TrocaDeConfiguracao(ConfiguracaoAtiva configuracao, CacheEstadoLeilao cache) {
        this.configuracao = configuracao;
        this.cache = cache;
    }

    /**
     * Devolve a configuração em vigor depois da troca. Limpa o Redis só ao ligá-lo (A/B para C);
     * se a limpeza falhar, lança a exceção e deixa a configuração como estava.
     */
    public Configuracao trocar(Configuracao nova) {
        boolean religaRedis = !configuracao.atual().usaRedis() && nova.usaRedis();
        if (religaRedis) {
            cache.apagarTudo(); // antes da troca: se falhar, a configuração não muda
        }
        return configuracao.trocar(nova);
    }
}
