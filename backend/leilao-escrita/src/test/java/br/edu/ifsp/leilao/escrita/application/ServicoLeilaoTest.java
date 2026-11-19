package br.edu.ifsp.leilao.escrita.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.estado.cache.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.cache.Checkpoint;
import br.edu.ifsp.leilao.estado.cache.Configuracao;
import br.edu.ifsp.leilao.estado.cache.ConfiguracaoAtiva;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.cache.LeitorEventos;
import br.edu.ifsp.leilao.estado.cache.ObterEstado;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ServicoLeilaoTest {
    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");

    static class EventStoreFalso extends LeitorEventos implements EventStore {
        final List<EventoLeilao> eventos = new ArrayList<>();
        final List<Long> lancesDoVencedor = new ArrayList<>();
        int chamadas;
        int conflitos;

        EventStoreFalso() {
            super(null, null);
        }

        @Override
        public void anexar(UUID leilaoId, int versaoEsperada, List<EventoLeilao> novos) {
            chamadas++;
            if (chamadas <= conflitos) {
                eventos.add(new LanceRegistrado("licitante-1", lancesDoVencedor.get(chamadas - 1)));
                throw new ConflitoDeVersaoException(leilaoId, versaoEsperada + 1);
            }
            eventos.addAll(novos);
        }

        @Override
        public List<EventoLeilao> posteriores(UUID leilaoId, int versao) {
            return List.copyOf(eventos.subList(Math.min(versao, eventos.size()), eventos.size()));
        }
    }

    static class CacheFalso extends CacheEstadoLeilao {
        CacheFalso(ConfiguracaoAtiva c) {
            super(null, null, c);
        }

        @Override
        public boolean gravar(UUID leilaoId, EstadoLeilao estado) {
            return false;
        }
    }

    final ConfiguracaoAtiva config = new ConfiguracaoAtiva(Configuracao.A);
    final EventStoreFalso store = new EventStoreFalso();
    final CacheFalso cache = new CacheFalso(config);
    final Checkpoint checkpoint = new Checkpoint(null, null, 50, config);
    final ObterEstado obterEstado = new ObterEstado(cache, checkpoint, store, new SimpleMeterRegistry(), config);
    final ServicoLeilao servico = new ServicoLeilao(store, obterEstado, cache, checkpoint);

    ServicoLeilaoTest() {
        Instant agora = Instant.now();
        Instant fim = agora.plus(1, ChronoUnit.HOURS);
        store.eventos.add(new LeilaoCriado("vendedor-1", "Notebook", 1_000, 100, agora.minus(1, ChronoUnit.HOURS), fim));
        store.eventos.add(new LeilaoIniciado(fim));
    }

    @Test
    void lanceSemDisputaTemUmaTentativa() {
        Resultado r = servico.darLance(ID, "licitante-2", 2_000);
        assertEquals(1, r.tentativas());
        assertEquals(3, r.versao());
    }

    @Test
    void lanceQuePerdeADisputaUmaVezVoltaComDuasTentativas() {
        store.conflitos = 1;
        store.lancesDoVencedor.add(1_500L);
        Resultado r = servico.darLance(ID, "licitante-2", 2_000);
        assertEquals(2, r.tentativas());
        assertEquals(4, r.versao());
    }

    @Test
    void recusaDepoisDeRetentarCarregaAsTentativas() {
        store.conflitos = 1;
        store.lancesDoVencedor.add(3_000L);
        var e = assertThrows(LanceRecusadoException.class, () -> servico.darLance(ID, "licitante-2", 2_000));
        assertEquals(2, e.tentativas());
        assertEquals("LANCE_ABAIXO_DO_MINIMO", e.codigo());
    }

    @Test
    void recusaSemDisputaTemUmaTentativa() {
        var e = assertThrows(LanceRecusadoException.class, () -> servico.darLance(ID, "licitante-2", 10));
        assertEquals(1, e.tentativas());
    }

    @Test
    void conflitoNasTresTentativasDevolveTres() {
        store.conflitos = 3;
        store.lancesDoVencedor.addAll(List.of(1_100L, 1_200L, 1_300L));
        var e = assertThrows(ConflitoDeVersaoException.class, () -> servico.darLance(ID, "licitante-2", 5_000));
        assertEquals(3, e.tentativas());
    }

    @Test
    void cancelarRecusadoTambemVemComoLanceRecusado() {
        store.eventos.add(new LanceRegistrado("licitante-1", 1_000));
        var e = assertThrows(LanceRecusadoException.class, () -> servico.cancelar(ID, "teste"));
        assertEquals("LEILAO_COM_LANCES", e.codigo());
    }
}
