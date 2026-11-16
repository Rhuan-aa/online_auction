package br.edu.ifsp.leilao.leitura.consultas;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.estado.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.Configuracao;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import br.edu.ifsp.leilao.estado.ObterEstado;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** De onde a lista tira os ids e como filtra. Sem Redis nem banco: tudo em memória. */
class ListagemLeiloesTest {

    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final UUID ABERTO_TARDE = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID ABERTO_CEDO = UUID.fromString("22222222-2222-2222-2222-222222222222");
    static final UUID CANCELADO = UUID.fromString("33333333-3333-3333-3333-333333333333");

    static EstadoLeilao aberto(String titulo, Instant fim) {
        return EstadoLeilao.INICIAL
                .aplicar(new LeilaoCriado("vendedor-1", titulo, 10_000, 100, INICIO, fim))
                .aplicar(new LeilaoIniciado(fim));
    }

    /** Todos os estados "do mundo". */
    final Map<UUID, EstadoLeilao> estados = Map.of(
            ABERTO_TARDE, aberto("Tarde", INICIO.plusSeconds(7200)),
            ABERTO_CEDO, aberto("Cedo", INICIO.plusSeconds(3600)),
            CANCELADO, aberto("Cancelado", INICIO.plusSeconds(60)).aplicar(new LeilaoCancelado("x")));


    Optional<List<UUID>> indice = Optional.empty();
    /** Anota quem foi perguntado ao Event Store. */
    final List<String> idasAoEventStore = new ArrayList<>();
    final List<Map<UUID, EstadoLeilao>> repovoamentos = new ArrayList<>();

    final ListagemLeiloes listagem = new ListagemLeiloes(
            new ObterEstado(null, null, null, new SimpleMeterRegistry()) {
                @Override
                public Map<UUID, EstadoLeilao> obterVariosParaConsulta(List<UUID> leiloes) {
                    Map<UUID, EstadoLeilao> achados = new LinkedHashMap<>();
                    leiloes.forEach(id -> achados.put(id, estados.get(id)));
                    return achados;
                }
            },
            new CacheEstadoLeilao(null, null, Configuracao.C) {
                @Override
                public Optional<List<UUID>> abertos() {
                    return indice;
                }

                @Override
                public void repovoarAbertos(Map<UUID, EstadoLeilao> estadosDeTodos) {
                    repovoamentos.add(estadosDeTodos);
                }
            },
            new LeitorEventos(null, null) {
                @Override
                public List<UUID> idsDosLeiloes() {
                    idasAoEventStore.add("idsDosLeiloes");
                    return List.of(ABERTO_TARDE, ABERTO_CEDO, CANCELADO);
                }
            });

    static List<String> titulos(List<ListagemLeiloes.LeilaoResumo> lista) {
        return lista.stream().map(ListagemLeiloes.LeilaoResumo::titulo).toList();
    }

    @Test
    void abertosVemDoIndiceSemIrAoEventStoreEOrdenadosPeloFim() {
        indice = Optional.of(List.of(ABERTO_TARDE, ABERTO_CEDO));
        assertEquals(List.of("Cedo", "Tarde"), titulos(listagem.listar("ABERTO")));
        assertEquals(List.of(), idasAoEventStore);
        assertEquals(List.of(), repovoamentos);
    }

    @Test
    void entradaVelhaNoIndiceNaoApareceNaLista() {
        indice = Optional.of(List.of(ABERTO_CEDO, CANCELADO)); // o cancelado ficou no índice por engano
        assertEquals(List.of("Cedo"), titulos(listagem.listar("ABERTO")));
    }

    @Test
    void indiceIncompletoCaiParaOEventStoreERefazOIndice() {
        indice = Optional.empty(); // sem o marcador: Redis reiniciado, LRU ou fora do ar
        assertEquals(List.of("Cedo", "Tarde"), titulos(listagem.listar("ABERTO")));
        assertEquals(List.of("idsDosLeiloes"), idasAoEventStore);
        assertEquals(List.of(estados.keySet()), repovoamentos.stream().map(Map::keySet).toList());
    }

    @Test
    void indiceCompletoSemNenhumAbertoNaoVaiAoEventStore() {
        indice = Optional.of(List.of()); // só o marcador: de fato não há leilão aberto
        assertEquals(List.of(), listagem.listar("ABERTO"));
        assertEquals(List.of(), idasAoEventStore);
    }

    @Test
    void outrosFiltrosETodosUsamOEventStore() {
        assertEquals(List.of("Cancelado"), titulos(listagem.listar("CANCELADO")));
        assertEquals(List.of("Cancelado", "Cedo", "Tarde"), titulos(listagem.listar(null)));
    }
}
