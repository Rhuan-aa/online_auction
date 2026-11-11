package br.edu.ifsp.leilao.leitura.notificacoes;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Sem Kafka e sem log: o canal é trocado por uma lista (é para isso que existe a interface CanalNotificacao). */
class NotificadorTest {

    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final Instant AGORA = Instant.parse("2026-11-16T18:00:00Z");

    final JsonMapper json = JsonMapper.builder().build();
    final List<String> enviados = new ArrayList<>();
    final Notificador notificador = new Notificador((para, mensagem) -> enviados.add(para + ": " + mensagem), json);

    void evento(int versao, String tipo, EventoLeilao dados) {
        JsonNode node = json.valueToTree(dados);
        notificador.processar(new EnvelopeEvento<>(versao, ID, versao, tipo, AGORA, node));
    }

    void criado() {
        evento(1, "LeilaoCriado.v1", new LeilaoCriado("vendedor-1", "Notebook", 10_000, 1_000, AGORA, AGORA.plusSeconds(60)));
    }

    @Test
    void lanceSuperadoAvisaOLiderAnterior() {
        criado();
        evento(3, "LanceRegistrado.v1", new LanceRegistrado("licitante-1", 10_000));
        evento(4, "LanceRegistrado.v1", new LanceRegistrado("licitante-2", 11_000));
        assertEquals(List.of("licitante-1: Seu lance no leilão \"Notebook\" foi superado: novo lance de R$ 110,00"), enviados);
    }

    @Test
    void licitanteQueCobreOProprioLanceNaoRecebeAviso() {
        criado();
        evento(3, "LanceRegistrado.v1", new LanceRegistrado("licitante-1", 10_000));
        evento(4, "LanceRegistrado.v1", new LanceRegistrado("licitante-1", 11_000));
        assertEquals(List.of(), enviados);
    }

    @Test
    void encerramentoAvisaVencedorEVendedor() {
        criado();
        evento(3, "LanceRegistrado.v1", new LanceRegistrado("licitante-2", 11_000));
        evento(4, "LeilaoEncerrado.v1", new LeilaoEncerrado("licitante-2", 11_000L));
        assertEquals(List.of(
                "licitante-2: Você venceu o leilão \"Notebook\" com R$ 110,00",
                "vendedor-1: Seu leilão \"Notebook\" terminou: licitante-2 venceu com R$ 110,00"), enviados);
    }

    @Test
    void encerramentoSemLancesAvisaSoOVendedor() {
        criado();
        evento(3, "LeilaoEncerrado.v1", new LeilaoEncerrado(null, null));
        assertEquals(List.of("vendedor-1: Seu leilão \"Notebook\" terminou sem lances"), enviados);
    }

    @Test
    void eventoRepetidoNaoGeraAvisoDuplicado() {
        criado();
        evento(3, "LanceRegistrado.v1", new LanceRegistrado("licitante-1", 10_000));
        evento(4, "LanceRegistrado.v1", new LanceRegistrado("licitante-2", 11_000));
        evento(4, "LanceRegistrado.v1", new LanceRegistrado("licitante-2", 11_000)); // o Kafka entregou de novo
        assertEquals(1, enviados.size());
    }
}
