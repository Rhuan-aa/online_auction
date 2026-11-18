package br.edu.ifsp.leilao.estado;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class TrocaDeConfiguracaoTest {

    /** Cache que só conta quantas vezes foi apagado. */
    static class CacheContador extends CacheEstadoLeilao {
        int apagamentos;

        CacheContador(ConfiguracaoAtiva configuracao) {
            super(null, null, configuracao);
        }

        @Override
        public long apagarTudo() {
            apagamentos++;
            return 0;
        }
    }

    /** Parte de `de`, troca para `para` e devolve quantas vezes o Redis foi apagado. */
    private int apagamentosAoTrocar(Configuracao de, Configuracao para) {
        var configuracao = new ConfiguracaoAtiva(de);
        var cache = new CacheContador(configuracao);
        assertEquals(para, new TrocaDeConfiguracao(configuracao, cache).trocar(para));
        assertEquals(para, configuracao.atual());
        return cache.apagamentos;
    }

    @Test
    void deCParaANaoLimpa() {
        assertEquals(0, apagamentosAoTrocar(Configuracao.C, Configuracao.A));
    }

    @Test
    void deAParaCLimpaUmaVez() {
        assertEquals(1, apagamentosAoTrocar(Configuracao.A, Configuracao.C));
    }

    @Test
    void deBParaCLimpaUmaVez() {
        assertEquals(1, apagamentosAoTrocar(Configuracao.B, Configuracao.C));
    }

    @Test
    void deCParaCNaoLimpa() {
        assertEquals(0, apagamentosAoTrocar(Configuracao.C, Configuracao.C));
    }

    @Test
    void deAParaBNaoLimpa() {
        assertEquals(0, apagamentosAoTrocar(Configuracao.A, Configuracao.B));
    }
}
