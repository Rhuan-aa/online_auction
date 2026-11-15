package br.edu.ifsp.leilao.estado;

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

/**
 * Sem Redis nem banco: o cache e o Event Store são trocados por versões em memória,
 * para mostrar quantos eventos cada caminho precisa ler.
 */
class ObterEstadoTest {

    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final List<EventoLeilao> EVENTOS = EstadoLeilaoTest.EVENTOS; // 6 eventos
    static final EstadoLeilao ATUAL = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS);

    /** Event Store em memória que anota a partir de qual versão cada leitura pediu. */
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

    /** Redis em memória, com a mesma regra do Lua: só grava se a versão for maior. */
    static class CacheFalso extends CacheEstadoLeilao {
        final Map<UUID, EstadoLeilao> guardado = new HashMap<>();

        CacheFalso() {
            super(null, null, Configuracao.C);
        }

        @Override
        public Optional<EstadoLeilao> ler(UUID leilaoId) {
            return Optional.ofNullable(guardado.get(leilaoId));
        }

        @Override
        public Map<UUID, EstadoLeilao> lerVarios(List<UUID> leiloes) {
            Map<UUID, EstadoLeilao> achados = new HashMap<>();
            leiloes.stream().filter(guardado::containsKey).forEach(id -> achados.put(id, guardado.get(id)));
            return achados;
        }

        @Override
        public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
            EstadoLeilao atual = guardado.get(leilaoId);
            if (atual != null && atual.versao() >= estado.versao()) {
                return false;
            }
            guardado.put(leilaoId, estado);
            return true;
        }
    }

    /** Checkpoint em memória. */
    static class CheckpointFalso extends Checkpoint {
        final Map<UUID, EstadoLeilao> guardado = new HashMap<>();

        CheckpointFalso() {
            super(null, null, 50, Configuracao.C);
        }

        @Override
        public Optional<EstadoLeilao> ler(UUID leilaoId) {
            return Optional.ofNullable(guardado.get(leilaoId));
        }
    }

    final EventStoreFalso eventStore = new EventStoreFalso();
    final CacheFalso cache = new CacheFalso();
    final CheckpointFalso checkpoint = new CheckpointFalso();
    final SimpleMeterRegistry metricas = new SimpleMeterRegistry();
    final ObterEstado obterEstado = new ObterEstado(cache, checkpoint, eventStore, metricas);

    @Test
    void semCopiaLeTodosOsEventosEGuardaNoCache() {
        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);
        assertEquals(ATUAL, cache.guardado.get(ID)); // o próximo pedido já encontra a cópia
    }

    @Test
    void comCopiaAtrasadaLeSoOsEventosQueFaltam() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4))); // cópia na versão 4

        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(4), eventStore.pedidosAPartirDe); // leu só as versões 5 e 6
        assertEquals(6, cache.guardado.get(ID).versao());       // e atualizou a cópia
    }

    /** As métricas que o painel de ADM lê: de onde veio a cópia e quantos eventos foram lidos. */
    @Test
    void metricasContamDeOndeVeioACopiaEQuantosEventosForamLidos() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4))); // cópia na v4

        obterEstado.obter(ID);      // completa a partir do Redis: lê 2 eventos
        obterEstado.obterDaFonte(ID); // relê tudo: 6 eventos

        var doRedis = metricas.get("leilao.estado.eventos.lidos").tag("base", "redis").summary();
        var daFonte = metricas.get("leilao.estado.eventos.lidos").tag("base", "fonte").summary();
        assertEquals(1, doRedis.count());
        assertEquals(2, doRedis.totalAmount());
        assertEquals(6, daFonte.totalAmount());
        assertEquals(1, metricas.get("leilao.estado.obter").tag("caminho", "comando").timer().count());
    }

    /** Configuração A: Redis e checkpoint desligados se comportam como vazios, e o resultado é o mesmo. */
    @Test
    void configuracaoASemCopiasRelêTudoEDaOMesmoEstado() {
        CacheEstadoLeilao redisDesligado = new CacheEstadoLeilao(null, null, Configuracao.A);
        Checkpoint checkpointDesligado = new Checkpoint(null, null, 50, Configuracao.A);

        ObterEstado configuracaoA = new ObterEstado(redisDesligado, checkpointDesligado, eventStore, metricas);

        assertEquals(Optional.of(ATUAL), configuracaoA.obter(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe); // releu desde o início
    }

    @Test
    void semRedisParteDoCheckpointELeSoOQueVeioDepois() {
        checkpoint.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3))); // checkpoint na v3

        assertEquals(Optional.of(ATUAL), obterEstado.obter(ID));
        assertEquals(List.of(3), eventStore.pedidosAPartirDe); // leu só as versões 4, 5 e 6
        assertEquals(6, cache.guardado.get(ID).versao());       // e deixou a cópia completa no Redis
    }

    @Test
    void consultaConfiaNaCopiaQueTemAVersaoMinimaSemIrAoEventStore() {
        EstadoLeilao copiaV4 = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4));
        cache.guardado.put(ID, copiaV4);

        assertEquals(Optional.of(copiaV4), obterEstado.obterParaConsulta(ID, 0)); // sem mínima: qualquer cópia
        assertEquals(Optional.of(copiaV4), obterEstado.obterParaConsulta(ID, 4)); // cópia já tem a v4
        assertEquals(List.of(), eventStore.pedidosAPartirDe);                     // não foi ao banco
    }

    @Test
    void consultaComCopiaAtrasDaVersaoMinimaCompletaPeloEventStore() {
        cache.guardado.put(ID, EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4))); // cópia na v4

        assertEquals(Optional.of(ATUAL), obterEstado.obterParaConsulta(ID, 6)); // pediu pelo menos a v6
        assertEquals(List.of(4), eventStore.pedidosAPartirDe);                  // leu só o que faltava
        assertEquals(6, cache.guardado.get(ID).versao());                       // e consertou a cópia
    }

    @Test
    void variosDeUmaVezUsaAsCopiasEReconstroiSoOsQueFaltam() {
        UUID semCopia = UUID.fromString("22222222-2222-2222-2222-222222222222");
        EstadoLeilao copiaV4 = EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 4));
        cache.guardado.put(ID, copiaV4);

        Map<UUID, EstadoLeilao> estados = obterEstado.obterVariosParaConsulta(List.of(semCopia, ID));

        assertEquals(List.of(semCopia, ID), List.copyOf(estados.keySet())); // mantém a ordem pedida
        assertEquals(copiaV4, estados.get(ID));                             // confiou na cópia
        assertEquals(ATUAL, estados.get(semCopia));                         // reconstruiu o que faltava
        assertEquals(List.of(0), eventStore.pedidosAPartirDe);              // só esse foi ao banco
    }

    @Test
    void obterDaFonteIgnoraOCacheMesmoComCopiaEmDia() {
        cache.guardado.put(ID, ATUAL);

        assertEquals(Optional.of(ATUAL), obterEstado.obterDaFonte(ID));
        assertEquals(List.of(0), eventStore.pedidosAPartirDe); // releu tudo
    }

    @Test
    void leilaoSemEventosNaoExiste() {
        EventStoreFalso vazio = new EventStoreFalso() {
            @Override
            public List<EventoLeilao> posteriores(UUID leilaoId, int versao) {
                return List.of();
            }
        };
        assertTrue(new ObterEstado(cache, checkpoint, vazio, metricas).obter(ID).isEmpty());
        assertTrue(cache.guardado.isEmpty()); // nada é guardado para um leilão que não existe
    }
}
