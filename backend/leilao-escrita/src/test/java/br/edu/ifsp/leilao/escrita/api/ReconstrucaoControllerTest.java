package br.edu.ifsp.leilao.escrita.api;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.http.MediaType.TEXT_PLAIN;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ReconstrucaoControllerTest {
    private final ReconstrucaoCache reconstrucao = new ReconstrucaoCache(null, null, null, null) {
        @Override
        public Relatorio reconstruir() {
            return new Relatorio(2, 5, 1, 2, List.of(), new Tempos(1, 2, 3, 4));
        }
    };
    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ReconstrucaoController(reconstrucao)).build();

    @Test
    void comJsonReconstroi() throws Exception {
        mvc.perform(post("/admin/cache/reconstruir").contentType(APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refeitos").value(2));
    }

    @Test
    void semJsonNaoReconstroi() throws Exception {
        mvc.perform(post("/admin/cache/reconstruir").contentType(TEXT_PLAIN).content("x"))
                .andExpect(status().isUnsupportedMediaType());
        mvc.perform(post("/admin/cache/reconstruir")).andExpect(status().isUnsupportedMediaType());
    }
}
