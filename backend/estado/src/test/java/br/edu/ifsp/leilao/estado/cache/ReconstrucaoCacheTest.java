package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import static br.edu.ifsp.leilao.estado.cache.ObterEstadoTest.ATUAL;
import static br.edu.ifsp.leilao.estado.cache.ObterEstadoTest.EVENTOS;
import static br.edu.ifsp.leilao.estado.cache.ObterEstadoTest.ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache.Relatorio;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ReconstrucaoCacheTest {
    static class EventStore extends ObterEstadoTest.EventStoreFalso {
        @Override
        public List<UUID> idsDosLeiloes() {
            return List.of(ID);
        }
    }

    static class Cache extends ObterEstadoTest.CacheFalso {
        int apagados;

        Cache(ConfiguracaoAtiva c) {
            super(c);
        }

        @Override
        public long apagarTudo() {
            apagados = guardado.size();
            guardado.clear();
            return apagados;
        }

        @Override
        public void repovoarAbertos(Map<UUID, EstadoLeilao> estados) {
        }
    }

    static class Checkpoints extends ObterEstadoTest.CheckpointFalso {
        int apagados;

        Checkpoints(ConfiguracaoAtiva c) {
            super(c);
        }

        @Override
        public int apagarTodos() {
            apagados = guardado.size();
            guardado.clear();
            return apagados;
        }

        @Override
        public void gravarSeNecessario(UUID leilaoId, int versaoAnterior, EstadoLeilao atual) {
            guardado.put(leilaoId, atual);
        }
    }

    final ConfiguracaoAtiva configuracao = new ConfiguracaoAtiva(Configuracao.C);
    final EventStore eventStore = new EventStore();
    final Cache cache = new Cache(configuracao);
    final Checkpoints checkpoint = new Checkpoints(configuracao);
    final ObterEstado obterEstado = new ObterEstado(cache, checkpoint, eventStore, new SimpleMeterRegistry(), configuracao);
    final ReconstrucaoCache reconstrucao = new ReconstrucaoCache(eventStore, obterEstado, cache, checkpoint);

    @Test
    void refazTodosEInformaIdenticos() {
        cache.guardado.put(ID, ATUAL);
        Relatorio r = reconstrucao.reconstruir();
        assertEquals(1, r.leiloes());
        assertEquals(1, r.refeitos());
        assertEquals(1, r.chavesApagadas());
        assertTrue(r.diferentes().isEmpty());
        assertEquals(ATUAL, cache.guardado.get(ID));
    }

    @Test
    void copiaAtrasadaApareceEmDiferentes() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3)));
        Relatorio r = reconstrucao.reconstruir();
        assertEquals(List.of(ID), r.diferentes());
        assertEquals(ATUAL, cache.guardado.get(ID));
        assertTrue(r.tempos().fotografiaMs() >= 0 && r.tempos().refazerMs() >= 0);
    }
}
