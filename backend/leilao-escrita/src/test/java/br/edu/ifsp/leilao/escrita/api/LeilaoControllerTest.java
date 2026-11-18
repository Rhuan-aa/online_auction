package br.edu.ifsp.leilao.escrita.api;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.edu.ifsp.leilao.escrita.application.ConflitoDeVersaoException;
import br.edu.ifsp.leilao.escrita.application.LanceRecusadoException;
import br.edu.ifsp.leilao.escrita.application.LeilaoNaoEncontradoException;
import br.edu.ifsp.leilao.escrita.application.Resultado;
import br.edu.ifsp.leilao.escrita.application.ServicoLeilao;
import br.edu.ifsp.leilao.escrita.domain.RegraVioladaException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class LeilaoControllerTest {

    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final String CORPO = "{\"licitanteId\":\"licitante-2\",\"valor\":2000}";

    final ServicoLeilao servico = mock(ServicoLeilao.class);
    final MockMvc mvc = MockMvcBuilders.standaloneSetup(new LeilaoController(servico))
            .setControllerAdvice(new TratadorErros()).build();

    private ResultActions lance() throws Exception {
        return mvc.perform(post("/leiloes/" + ID + "/lances").contentType(APPLICATION_JSON).content(CORPO));
    }

    @Test
    void sucessoInformaVersaoETentativas() throws Exception {
        when(servico.darLance(any(), anyString(), anyLong())).thenReturn(new Resultado(7, 2));
        lance().andExpect(status().isOk()).andExpect(jsonPath("$.versao").value(7))
                .andExpect(jsonPath("$.tentativas").value(2));
    }

    @Test
    void recusaInformaTentativas() throws Exception {
        when(servico.darLance(any(), anyString(), anyLong())).thenThrow(new LanceRecusadoException(
                new RegraVioladaException("LANCE_ABAIXO_DO_MINIMO", "Lance mínimo é 3100"), 2));
        lance().andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.erro").value("LANCE_ABAIXO_DO_MINIMO"))
                .andExpect(jsonPath("$.mensagem").value("Lance mínimo é 3100"))
                .andExpect(jsonPath("$.tentativas").value(2));
    }

    @Test
    void conflitoInformaTresTentativas() throws Exception {
        when(servico.darLance(any(), anyString(), anyLong()))
                .thenThrow(new ConflitoDeVersaoException(new ConflitoDeVersaoException(ID, 3), 3));
        lance().andExpect(status().isConflict()).andExpect(jsonPath("$.erro").value("CONFLITO_DE_VERSAO"))
                .andExpect(jsonPath("$.tentativas").value(3));
    }

    @Test
    void naoEncontradoNaoTemTentativas() throws Exception {
        when(servico.darLance(any(), anyString(), anyLong())).thenThrow(new LeilaoNaoEncontradoException(ID));
        lance().andExpect(status().isNotFound()).andExpect(jsonPath("$.erro").value("LEILAO_NAO_ENCONTRADO"))
                .andExpect(jsonPath("$.tentativas").doesNotExist());
    }
}
