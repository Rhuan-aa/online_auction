package br.edu.ifsp.leilao.leitura.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.leitura.notificacoes.Notificacao;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class TransmissorNotificacoesTest {
    private final TransmissorNotificacoes transmissor = new TransmissorNotificacoes();

    @Test
    void cadaPessoaTemAsPropriasAssinaturas() {
        transmissor.assinar("ana");
        transmissor.assinar("ana");
        transmissor.assinar("bruno");
        assertEquals(2, transmissor.assinantes("ana"));
        assertEquals(1, transmissor.assinantes("bruno"));
        assertEquals(0, transmissor.assinantes("carla"));
    }

    @Test
    void avisoParaQuemNaoAssinouNaoFalha() {
        transmissor.assinar("ana");
        transmissor.enviar(new Notificacao("bruno", UUID.randomUUID(), Notificacao.Tipo.SUPERADO, "x"));
        transmissor.enviar(new Notificacao("ana", UUID.randomUUID(), Notificacao.Tipo.VENCEU, "y"));
        assertEquals(1, transmissor.assinantes("ana"));
    }

    @Test
    void oJsonDoAvisoTrazTipoELeilao() {
        UUID id = UUID.fromString("11111111-1111-1111-1111-111111111111");
        String saida = JsonMapper.builder().build()
                .writeValueAsString(new Notificacao("ana", id, Notificacao.Tipo.SUPERADO, "superado"));
        assertTrue(saida.contains("\"tipo\":\"SUPERADO\""), saida);
        assertTrue(saida.contains("\"leilaoId\":\"" + id + "\""), saida);
        assertTrue(saida.contains("\"destinatarioId\":\"ana\""), saida);
    }
}
