package br.edu.ifsp.leilao.estado;

import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * A configuração A/B/C em vigor, compartilhada por quem lê e grava cópias do estado e trocável em
 * tempo de execução (painel de ADM). leilao.cache.configuracao é só o valor inicial.
 * Quem usa consulta atual() a cada operação, em vez de guardar o valor.
 */
@Component
public class ConfiguracaoAtiva {

    private final AtomicReference<Configuracao> atual;

    public ConfiguracaoAtiva(@Value("${leilao.cache.configuracao:C}") Configuracao inicial) {
        this.atual = new AtomicReference<>(inicial);
    }

    public Configuracao atual() {
        return atual.get();
    }

    /** Passa a valer já na próxima operação. Devolve a nova configuração. */
    public Configuracao trocar(Configuracao nova) {
        atual.set(nova);
        return nova;
    }
}
