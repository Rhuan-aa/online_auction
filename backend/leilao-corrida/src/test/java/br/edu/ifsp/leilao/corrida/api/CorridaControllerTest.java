package br.edu.ifsp.leilao.corrida.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.edu.ifsp.leilao.corrida.motor.Foto;
import br.edu.ifsp.leilao.corrida.motor.MotorCorrida;
import br.edu.ifsp.leilao.corrida.motor.Parametros;
import br.edu.ifsp.leilao.corrida.motor.ValidadorParametros;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class CorridaControllerTest {
    static class MotorFalso implements MotorCorrida {
        UUID atual;
        boolean rodando;
        ValidadorParametros.Pedido ultimoPedido;
        int paradas;

        @Override
        public UUID iniciar(ValidadorParametros.Pedido pedido) {
            if (rodando) {
                throw new CorridaEmAndamentoException(atual);
            }
            ultimoPedido = pedido;
            atual = UUID.randomUUID();
            rodando = true;
            return atual;
        }

        @Override
        public boolean parar(UUID id) {
            if (!id.equals(atual)) return false;
            paradas++;
            rodando = false;
            return true;
        }

        @Override
        public Optional<Foto> foto(UUID id) {
            return id.equals(atual)
                    ? Optional.of(new Foto(id.toString(), ultimoPedido.parametros(), 12.3, rodando, List.of()))
                    : Optional.empty();
        }

        @Override
        public Optional<SseEmitter> assinar(UUID id) {
            return id.equals(atual) ? Optional.of(new SseEmitter(0L)) : Optional.empty();
        }
    }

    private static final String CORPO =
            "{\"licitantes\":5,\"lancesPorLicitante\":5,\"simultaneos\":4,\"leitores\":2,\"precoInicial\":10000,\"incremento\":100}";

    private final MotorFalso motor = new MotorFalso();
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new CorridaController(motor, 42, 2000, 2_000_000)).build();

    private ResultActions iniciar(String corpo) throws Exception {
        return mvc.perform(post("/corrida").contentType(APPLICATION_JSON).content(corpo));
    }

    @Test
    void criaE201ComOId() throws Exception {
        iniciar(CORPO).andExpect(status().isCreated()).andExpect(jsonPath("$.corridaId").value(motor.atual.toString()));
        assertEquals(new Parametros(5, 5, 4, 2, 10_000, 100), motor.ultimoPedido.parametros());
        assertEquals(42, motor.ultimoPedido.semente());
    }

    @Test
    void segundaCorridaEnquantoRodaE409() throws Exception {
        iniciar(CORPO).andExpect(status().isCreated());
        iniciar(CORPO).andExpect(status().isConflict())
                .andExpect(jsonPath("$.erro").value("CORRIDA_EM_ANDAMENTO"))
                .andExpect(jsonPath("$.corridaId").value(motor.atual.toString()))
                .andExpect(jsonPath("$.mensagem").exists());
    }

    @Test
    void alemDoOrcamentoE400ComMensagem() throws Exception {
        iniciar(CORPO.replace("\"simultaneos\":4", "\"simultaneos\":999")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").value(org.hamcrest.Matchers.containsString("Threads demais")));
        assertNull(motor.atual);
    }

    @Test
    void parametroInvalidoE400() throws Exception {
        iniciar(CORPO.replace("\"licitantes\":5", "\"licitantes\":0")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("PARAMETRO_INVALIDO"))
                .andExpect(jsonPath("$.mensagem").exists());
        iniciar("{nao é json").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.erro").value("PARAMETRO_INVALIDO"));
        assertNull(motor.atual, "nada foi iniciado");
    }

    @Test
    void pararE204IdempotenteE404SeNaoExiste() throws Exception {
        iniciar(CORPO);
        String id = motor.atual.toString();
        mvc.perform(post("/corrida/" + id + "/parar")).andExpect(status().isNoContent());
        mvc.perform(post("/corrida/" + id + "/parar")).andExpect(status().isNoContent());
        mvc.perform(post("/corrida/" + UUID.randomUUID() + "/parar")).andExpect(status().isNotFound());
        mvc.perform(post("/corrida/nao-e-uuid/parar")).andExpect(status().isNotFound());

        iniciar(CORPO).andExpect(status().isCreated());
    }

    @Test
    void consultaDevolveAFotoOu404() throws Exception {
        iniciar(CORPO);
        mvc.perform(get("/corrida/" + motor.atual)).andExpect(status().isOk())
                .andExpect(jsonPath("$.corridaId").value(motor.atual.toString()))
                .andExpect(jsonPath("$.parametros.licitantes").value(5))
                .andExpect(jsonPath("$.rodando").value(true));
        mvc.perform(get("/corrida/" + UUID.randomUUID())).andExpect(status().isNotFound());
    }

    @Test
    void streamDe404SeNaoExiste() throws Exception {
        mvc.perform(get("/corrida/" + UUID.randomUUID() + "/stream")).andExpect(status().isNotFound());
    }
}
