package br.edu.ifsp.leilao.leitura.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.leitura.api.LeilaoDetalhe.EventoInfo;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TransmissorSseTest {

    private final JsonMapper json = JsonMapper.builder().build();

    private LeilaoDetalhe base() {
        return new LeilaoDetalhe(UUID.randomUUID(), "Relogio", "ABERTO", 100L, "ana", Instant.now(), 7, null);
    }

    @Test
    void mensagemAoVivoTrazTipoEVersaoDoEvento() {
        String saida = json.writeValueAsString(base().comEvento(new EventoInfo("LanceRegistrado.v1", 7)));

        assertTrue(saida.contains("\"evento\":{\"tipo\":\"LanceRegistrado.v1\",\"versao\":7}"), saida);
    }

    @Test
    void semEventoOJsonNaoTemOCampo() {
        assertFalse(json.writeValueAsString(base()).contains("\"evento\""));
    }
}
