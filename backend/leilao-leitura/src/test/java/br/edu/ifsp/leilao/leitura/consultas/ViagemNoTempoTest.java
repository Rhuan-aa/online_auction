package br.edu.ifsp.leilao.leitura.consultas;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import br.edu.ifsp.leilao.leitura.api.ConsultaController;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import tools.jackson.databind.json.JsonMapper;

class ViagemNoTempoTest {
    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final UUID OUTRO = UUID.fromString("22222222-2222-2222-2222-222222222222");
    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final Instant FIM = Instant.parse("2026-11-16T19:00:00Z");
    static final List<EventoLeilao> EVENTOS = List.of(
            new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, INICIO, FIM),
            new LeilaoIniciado(FIM),
            new LanceRegistrado("licitante-1", 10_000),
            new LanceRegistrado("licitante-2", 11_000));

    static class EventStoreFalso extends LeitorEventos {
        EventStoreFalso() {
            super(null, null);
        }

        @Override
        public List<EventoLeilao> ateVersao(UUID leilaoId, int n) {
            return ID.equals(leilaoId) ? EVENTOS.subList(0, Math.min(n, EVENTOS.size())) : List.of();
        }

        @Override
        public List<EventoGravado> todos(UUID leilaoId) {
            if (!ID.equals(leilaoId)) {
                return List.of();
            }
            var json = JsonMapper.builder().build();
            return List.of(new EventoGravado(1, "LanceRegistrado.v1",
                    json.readTree("{\"licitanteId\":\"licitante-1\",\"valor\":10000}"), INICIO));
        }
    }

    private final EventStoreFalso store = new EventStoreFalso();
    private final ViagemNoTempo viagem = new ViagemNoTempo(store);
    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ConsultaController(null, null, null, null, viagem, store))
            .build();

    @Test
    void estadoNaVersao3TemOsTresPrimeirosEventos() {
        var e = viagem.estadoNaVersao(ID, 3).orElseThrow();
        assertEquals(3, e.versao());
        assertEquals(EstadoLeilao.INICIAL.aplicarTodos(EVENTOS.subList(0, 3)), e);
    }

    @Test
    void versaoAlemDaAtualEhVazia() {
        assertTrue(viagem.estadoNaVersao(ID, 99).isEmpty());
        assertTrue(viagem.estadoNaVersao(OUTRO, 1).isEmpty());
        assertFalse(viagem.existe(OUTRO));
        assertTrue(viagem.existe(ID));
    }

    @Test
    void ateVersaoNoControllerDevolveOEstadoDaquelaVersao() throws Exception {
        mvc.perform(get("/leiloes/" + ID + "?ateVersao=3"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versao").value(3))
                .andExpect(jsonPath("$.precoAtual").value(10_000));
    }

    @Test
    void ateVersaoZeroOuAlemDaAtualDa400() throws Exception {
        mvc.perform(get("/leiloes/" + ID + "?ateVersao=0")).andExpect(status().isBadRequest());
        mvc.perform(get("/leiloes/" + ID + "?ateVersao=99")).andExpect(status().isBadRequest());
    }

    @Test
    void ateVersaoDeLeilaoInexistenteDa404() throws Exception {
        mvc.perform(get("/leiloes/" + OUTRO + "?ateVersao=1")).andExpect(status().isNotFound());
    }

    @Test
    void eventosSaemComDadosComoObjetoJson() throws Exception {
        mvc.perform(get("/leiloes/" + ID + "/eventos"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].versao").value(1))
                .andExpect(jsonPath("$[0].tipo").value("LanceRegistrado.v1"))
                .andExpect(jsonPath("$[0].dados.valor").value(10_000))
                .andExpect(jsonPath("$[0].criadoEm").exists());
        mvc.perform(get("/leiloes/" + OUTRO + "/eventos")).andExpect(status().isNotFound());
    }
}
