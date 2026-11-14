package br.edu.ifsp.leilao.leitura.consultas;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.estado.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import br.edu.ifsp.leilao.estado.ObterEstado;
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

    /** O que o índice de abertos tem no Redis (pode estar vazio ou com sobra). */
    List<UUID> indice = List.of();
    /** Anota quem foi perguntado ao Event Store. */
    final List<String> idasAoEventStore = new ArrayList<>();

    final ListagemLeiloes listagem = new ListagemLeiloes(
            new ObterEstado(null, null, null) {
                @Override
                public Map<UUID, EstadoLeilao> obterVariosParaConsulta(List<UUID> leiloes) {
                    Map<UUID, EstadoLeilao> achados = new LinkedHashMap<>();
                    leiloes.forEach(id -> achados.put(id, estados.get(id)));
                    return achados;
                }
            },
            new CacheEstadoLeilao(null, null) {
                @Override
                public Optional<List<UUID>> abertos() {
                    return Optional.of(indice);
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
        indice = List.of(ABERTO_TARDE, ABERTO_CEDO);
        assertEquals(List.of("Cedo", "Tarde"), titulos(listagem.listar("ABERTO")));
        assertEquals(List.of(), idasAoEventStore);
    }

    @Test
    void entradaVelhaNoIndiceNaoApareceNaLista() {
        indice = List.of(ABERTO_CEDO, CANCELADO); // o cancelado ficou no índice por engano
        assertEquals(List.of("Cedo"), titulos(listagem.listar("ABERTO")));
    }

    @Test
    void indiceVazioCaiParaOEventStore() {
        indice = List.of(); // Redis reiniciado
        assertEquals(List.of("Cedo", "Tarde"), titulos(listagem.listar("ABERTO")));
        assertEquals(List.of("idsDosLeiloes"), idasAoEventStore);
    }

    @Test
    void outrosFiltrosETodosUsamOEventStore() {
        assertEquals(List.of("Cancelado"), titulos(listagem.listar("CANCELADO")));
        assertEquals(List.of("Cancelado", "Cedo", "Tarde"), titulos(listagem.listar(null)));
    }
}
