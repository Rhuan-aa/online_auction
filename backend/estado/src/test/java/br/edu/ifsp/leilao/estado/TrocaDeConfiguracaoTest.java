package br.edu.ifsp.leilao.estado;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class TrocaDeConfiguracaoTest {
    static class CacheContador extends CacheEstadoLeilao {
        int apagamentos;
        final java.util.Set<String> chaves = new java.util.HashSet<>(java.util.Set.of("leiloes:abertos"));
        boolean falha;

        CacheContador(ConfiguracaoAtiva configuracao) {
            super(null, null, configuracao);
        }

        @Override
        public long apagarTudo() {
            apagamentos++;
            if (falha) {
                throw new IllegalStateException("Redis fora do ar");
            }
            long apagadas = chaves.size();
            chaves.clear();
            return apagadas;
        }
    }

    private int apagamentosAoTrocar(Configuracao de, Configuracao para) {
        var configuracao = new ConfiguracaoAtiva(de);
        var cache = new CacheContador(configuracao);
        assertEquals(para, new TrocaDeConfiguracao(configuracao, cache).trocar(para));
        assertEquals(para, configuracao.atual());
        return cache.apagamentos;
    }

    @Test
    void deAParaCApagaDeFatoAsChaves() {
        var configuracao = new ConfiguracaoAtiva(Configuracao.A);
        var cache = new CacheContador(configuracao);
        new TrocaDeConfiguracao(configuracao, cache).trocar(Configuracao.C);
        assertEquals(java.util.Set.of(), cache.chaves);
    }

    @Test
    void seALimpezaFalharNaoTrocaDeConfiguracao() {
        var configuracao = new ConfiguracaoAtiva(Configuracao.A);
        var cache = new CacheContador(configuracao);
        cache.falha = true;
        assertThrows(IllegalStateException.class,
                () -> new TrocaDeConfiguracao(configuracao, cache).trocar(Configuracao.C));
        assertEquals(Configuracao.A, configuracao.atual());
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
