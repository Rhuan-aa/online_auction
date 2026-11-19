package br.edu.ifsp.leilao.estado;

import java.util.concurrent.atomic.AtomicReference;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class ConfiguracaoAtiva {
    private final AtomicReference<Configuracao> atual;

    public ConfiguracaoAtiva(@Value("${leilao.cache.configuracao:C}") Configuracao inicial) {
        this.atual = new AtomicReference<>(inicial);
    }

    public Configuracao atual() {
        return atual.get();
    }

    public Configuracao trocar(Configuracao nova) {
        atual.set(nova);
        return nova;
    }
}
