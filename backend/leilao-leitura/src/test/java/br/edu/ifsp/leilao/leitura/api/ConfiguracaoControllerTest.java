package br.edu.ifsp.leilao.leitura.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.edu.ifsp.leilao.estado.cache.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.cache.Configuracao;
import br.edu.ifsp.leilao.estado.cache.ConfiguracaoAtiva;
import br.edu.ifsp.leilao.estado.cache.TrocaDeConfiguracao;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class ConfiguracaoControllerTest {
    static class CacheFalso extends CacheEstadoLeilao {
        int apagamentos;
        boolean falha;

        CacheFalso(ConfiguracaoAtiva configuracao) {
            super(null, null, configuracao);
        }

        @Override
        public long apagarTudo() {
            apagamentos++;
            if (falha) {
                throw new IllegalStateException("Redis fora do ar");
            }
            return 0;
        }
    }

    private final ConfiguracaoAtiva config = new ConfiguracaoAtiva(Configuracao.C);
    private final CacheFalso cache = new CacheFalso(config);
    private final MockMvc mvc = MockMvcBuilders
            .standaloneSetup(new ConfiguracaoController(config, new TrocaDeConfiguracao(config, cache)))
            .build();

    private org.springframework.test.web.servlet.ResultActions troca(String valor) throws Exception {
        return mvc.perform(put("/admin/cache/configuracao").contentType(APPLICATION_JSON)
                .content("{\"configuracao\":" + valor + "}"));
    }

    @Test
    void leAConfiguracaoAtual() throws Exception {
        mvc.perform(get("/admin/cache/configuracao"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.configuracao").value("C"));
    }

    @Test
    void trocaEDevolveANova() throws Exception {
        troca("\"B\"").andExpect(status().isOk()).andExpect(jsonPath("$.configuracao").value("B"));
        assertEquals(Configuracao.B, config.atual());
    }

    @Test
    void voltarParaCLimpaORedis() throws Exception {
        troca("\"A\"").andExpect(status().isOk());
        troca("\"C\"").andExpect(status().isOk());
        assertEquals(1, cache.apagamentos);
    }

    @Test
    void valorInvalidoE400() throws Exception {
        troca("\"Z\"").andExpect(status().isBadRequest());
        assertEquals(Configuracao.C, config.atual());
    }

    @Test
    void redisForaDoArAoVoltarParaCDa503EMantemAConfiguracao() throws Exception {
        troca("\"A\"").andExpect(status().isOk());
        cache.falha = true;
        troca("\"C\"").andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.erro").value("REDIS_INDISPONIVEL"))
                .andExpect(jsonPath("$.mensagem").exists());
        assertEquals(Configuracao.A, config.atual());
    }
}
