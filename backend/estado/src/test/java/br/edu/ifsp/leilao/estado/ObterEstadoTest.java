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
            super(null, null);
        }

        @Override
        public Optional<EstadoLeilao> ler(UUID leilaoId) {
            return Optional.ofNullable(guardado.get(leilaoId));
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

    final EventStoreFalso eventStore = new EventStoreFalso();
    final CacheFalso cache = new CacheFalso();
    final ObterEstado obterEstado = new ObterEstado(cache, eventStore);

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
        assertTrue(new ObterEstado(cache, vazio).obter(ID).isEmpty());
        assertTrue(cache.guardado.isEmpty()); // nada é guardado para um leilão que não existe
    }
}
