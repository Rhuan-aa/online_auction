package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;

class ObterEstadoTest {
    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final List<EventoLeilao> EVENTOS = EventosDeTeste.EVENTOS;
    static final EstadoLeilao ATUAL = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS);

    static class EventStoreFalso extends LeitorEventos {
        final List<Integer> pedidosAPartirDe = new ArrayList<>();

        EventStoreFalso() {
            super(null, null);
        }

        @Override
        public List<EventoLeilao> posteriores(UUID leilaoId, int versao) {
            pedidosAPartirDe.add(versao);
            return EVENTOS.subList(Math.min(versao, EVENTOS.size()), EVENTOS.size());
        }
    }

    static class CacheFalso extends CacheEstadoLeilao {
        final Map<UUID, EstadoLeilao> guardado = new HashMap<>();

        final ConfiguracaoAtiva configuracao;

        CacheFalso(ConfiguracaoAtiva configuracao) {
            super(null, null, configuracao);
            this.configuracao = configuracao;
        }

        boolean ligado() {
            return configuracao.atual().usaRedis();
        }

        @Override
        public Optional<EstadoLeilao> ler(UUID leilaoId) {
            return ligado() ? Optional.ofNullable(guardado.get(leilaoId)) : Optional.empty();
        }

        @Override
        public Map<UUID, EstadoLeilao> lerVarios(List<UUID> leiloes) {
            if (!ligado()) {
                return Map.of();
            }
            Map<UUID, EstadoLeilao> achados = new HashMap<>();
            leiloes.stream().filter(guardado::containsKey).forEach(id -> achados.put(id, guardado.get(id)));
            return achados;
        }

        @Override
        public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
            if (!ligado()) {
                return false;
            }
            EstadoLeilao atual = guardado.get(leilaoId);
            if (atual != null && atual.versao() >= estado.versao()) {
                return false;
            }
            guardado.put(leilaoId, estado);
            return true;
        }
    }

    static class CheckpointFalso extends Checkpoint {
        final Map<UUID, EstadoLeilao> guardado = new HashMap<>();

        final ConfiguracaoAtiva configuracao;

        CheckpointFalso(ConfiguracaoAtiva configuracao) {
            super(null, null, 50, configuracao);
            this.configuracao = configuracao;
        }

        @Override
        public Optional<EstadoLeilao> ler(UUID leilaoId) {
            return configuracao.atual().usaCheckpoint() ? Optional.ofNullable(guardado.get(leilaoId)) : Optional.empty();
        }
    }

    final EventStoreFalso eventStore = new EventStoreFalso();
    final ConfiguracaoAtiva configuracao = new ConfiguracaoAtiva(Configuracao.C);
    final CacheFalso cache = new CacheFalso(configuracao);
    final CheckpointFalso checkpoint = new CheckpointFalso(configuracao);
    final SimpleMeterRegistry metricas = new SimpleMeterRegistry();
    final ObterEstado obterEstado = new ObterEstado(cache, checkpoint, eventStore, metricas, configuracao);

    @Test
    void semCopiaLeTodosOsEventosEGuardaNoCache() {
        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
        assertEquals(ATUAL, cache.guardado.get(ID));
    }

    @Test
    void comCopiaAtrasadaLeSoOsEventosQueFaltam() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4)));

        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(4), eventStore.pedidosAPartirDe);
        assertEquals(6, cache.guardado.get(ID).versao());
    }

    @Test
    void metricasContamDeOndeVeioACopiaEQuantosEventosForamLidos() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4)));

        obterEstado.obter(ID);
        obterEstado.obterDaFonte(ID);

        var doRedis = metricas.get("leilao.estado.eventos.lidos").tag("base", "redis").tag("configuracao", "C").summary();
        var daFonte = metricas.get("leilao.estado.eventos.lidos").tag("base", "fonte").tag("configuracao", "C").summary();
        assertEquals(1, doRedis.count());
        assertEquals(2, doRedis.totalAmount());
        assertEquals(6, daFonte.totalAmount());
        assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").tag("configuracao", "C").timer().count());
    }

    @Test
    void emATodaObtencaoReleTodosOsEventosEMarcaATag() {
        cache.guardado.put(ID, ATUAL);
        checkpoint.guardado.put(ID, ATUAL);
        configuracao.trocar(Configuracao.A);

        obterEstado.obter(ID);

        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
        var lidos = metricas.get("leilao.estado.eventos.lidos").tag("configuracao", "A").summaries();
        assertEquals(EVENTOS.size(), (int) lidos.stream().mapToDouble(s -> s.totalAmount()).sum());
        assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").tag("configuracao", "A").timer().count());
    }

    @Test
    void trocarDeConfiguracaoSeparaAsMedicoes() {
        obterEstado.obter(ID);
        configuracao.trocar(Configuracao.B);
        obterEstado.obter(ID);

        assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").tag("configuracao", "C").timer().count());
        assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").tag("configuracao", "B").timer().count());
    }

    @Test
    void estadoObtidoEIgualNasTresConfiguracoes() {
        for (Configuracao c : Configuracao.values()) {
            configuracao.trocar(c);
            cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4)));
            checkpoint.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3)));
            assertEquals(Optional.of(ATUAL), obterEstado.obter(ID), "configuração " + c);
        }
    }

    @Test
    void configuracaoASemCopiasRelêTudoEDaOMesmoEstado() {
        ConfiguracaoAtiva a = new ConfiguracaoAtiva(Configuracao.A);
        CacheEstadoLeilao redisDesligado = new CacheEstadoLeilao(null, null, a);
        Checkpoint checkpointDesligado = new Checkpoint(null, null, 50, a);

        ObterEstado configuracaoA = new ObterEstado(redisDesligado, checkpointDesligado, eventStore, metricas, a);

        assertEquals(Optional.of(ATUAL), configuracaoA.obter(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
    }

    @Test
    void semRedisParteDoCheckpointELeSoOQueVeioDepois() {
        checkpoint.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3)));

        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(3), eventStore.pedidosAPartirDe);
        assertEquals(6, cache.guardado.get(ID).versao());
    }

    @Test
    void semRedisComCheckpointEmDiaRegravaACopiaNoRedis() {
        checkpoint.guardado.put(ID, ATUAL);

        assertEquals(Optional.of(ATUAL), obterEstado.obterParaConsulta(ID, 0));
        assertEquals(ATUAL, cache.guardado.get(ID));

        obterEstado.obterParaConsulta(ID, 0);
        assertEquals(List.of(6), eventStore.pedidosAPartirDe);
    }

    @Test
    void consultaConfiaNaCopiaQueTemAVersaoMinimaSemIrAoEventStore() {
        EstadoLeilao copiaV4 = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4));
        cache.guardado.put(ID, copiaV4);

        assertEquals(Optional.of(copiaV4), obterEstado.obterParaConsulta(ID, 0));
        assertEquals(Optional.of(copiaV4), obterEstado.obterParaConsulta(ID, 4));
        assertEquals(List.of(), eventStore.pedidosAPartirDe);
    }

    @Test
    void consultaComCopiaAtrasDaVersaoMinimaCompletaPeloEventStore() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4)));

        assertEquals(Optional.of(ATUAL), obterEstado.obterParaConsulta(ID, 6));
        assertEquals(List.of(4), eventStore.pedidosAPartirDe);
        assertEquals(6, cache.guardado.get(ID).versao());
    }

    @Test
    void variosDeUmaVezUsaAsCopiasEReconstroiSoOsQueFaltam() {
        UUID semCopia = UUID.fromString("22222222-2222-2222-2222-222222222222");
        EstadoLeilao copiaV4 = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4));
        cache.guardado.put(ID, copiaV4);

        Map<UUID, EstadoLeilao> estados = obterEstado.obterVariosParaConsulta(List.of(semCopia, ID));

        assertEquals(List.of(semCopia, ID), List.copyOf(estados.keySet()));
        assertEquals(copiaV4, estados.get(ID));
        assertEquals(ATUAL, estados.get(semCopia));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
    }

    @Test
    void obterDaFonteIgnoraOCacheMesmoComCopiaEmDia() {
        cache.guardado.put(ID, ATUAL);

        assertEquals(Optional.of(ATUAL), obterEstado.obterDaFonte(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
    }

    @Test
    void leilaoSemEventosNaoExiste() {
        EventStoreFalso vazio = new EventStoreFalso() {
            @Override
            public List<EventoLeilao> posteriores(UUID leilaoId, int versao) {
                return List.of();
            }
        };
        assertTrue(new ObterEstado(cache, checkpoint, vazio, metricas, configuracao).obter(ID).isEmpty());
        assertTrue(cache.guardado.isEmpty());
    }
}
