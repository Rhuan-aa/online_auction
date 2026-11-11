package br.edu.ifsp.leilao.leitura.notificacoes;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Consumidor independente (consumer group próprio): prova a extensibilidade do estilo,
 * porque entrou no sistema sem mudar uma linha do leilao-escrita.
 *
 * Avisa o licitante superado e, no encerramento, o vencedor e o vendedor.
 * Guarda em memória só o necessário: título, vendedor, líder atual e última versão de cada leilão.
 */
@Component
public class Notificador {

    private static final TypeReference<EnvelopeEvento<JsonNode>> ENVELOPE = new TypeReference<>() {};

    private record Acompanhamento(String titulo, String vendedorId, String liderId, int versao) {}

    private final Map<UUID, Acompanhamento> leiloes = new HashMap<>();
    private final CanalNotificacao canal;
    private final JsonMapper json;

    public Notificador(CanalNotificacao canal, JsonMapper json) {
        this.canal = canal;
        this.json = json;
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "leilao-leitura-notificacoes")
    public void receber(String mensagem) {
        processar(json.readValue(mensagem, ENVELOPE));
    }

    void processar(EnvelopeEvento<JsonNode> evento) {
        UUID id = evento.leilaoId();
        Acompanhamento atual = leiloes.get(id);
        if (atual != null && evento.versao() <= atual.versao()) {
            return; // evento repetido: não avisa duas vezes
        }

        switch (evento.tipo()) {
            case TiposEvento.LEILAO_CRIADO -> {
                LeilaoCriado criado = json.treeToValue(evento.dados(), LeilaoCriado.class);
                leiloes.put(id, new Acompanhamento(criado.titulo(), criado.vendedorId(), null, evento.versao()));
            }
            case TiposEvento.LANCE_REGISTRADO -> {
                if (atual == null) {
                    return;
                }
                LanceRegistrado lance = json.treeToValue(evento.dados(), LanceRegistrado.class);
                if (atual.liderId() != null && !atual.liderId().equals(lance.licitanteId())) {
                    canal.enviar(atual.liderId(), "Seu lance no leilão \"%s\" foi superado: novo lance de %s"
                            .formatted(atual.titulo(), reais(lance.valor())));
                }
                leiloes.put(id, new Acompanhamento(atual.titulo(), atual.vendedorId(), lance.licitanteId(), evento.versao()));
            }
            case TiposEvento.LEILAO_ENCERRADO -> {
                if (atual == null) {
                    return;
                }
                LeilaoEncerrado fim = json.treeToValue(evento.dados(), LeilaoEncerrado.class);
                if (fim.vencedorId() == null) {
                    canal.enviar(atual.vendedorId(), "Seu leilão \"%s\" terminou sem lances".formatted(atual.titulo()));
                } else {
                    String valor = reais(fim.valorVencedor());
                    canal.enviar(fim.vencedorId(), "Você venceu o leilão \"%s\" com %s".formatted(atual.titulo(), valor));
                    canal.enviar(atual.vendedorId(), "Seu leilão \"%s\" terminou: %s venceu com %s"
                            .formatted(atual.titulo(), fim.vencedorId(), valor));
                }
                leiloes.remove(id);
            }
            default -> { } // os outros eventos não geram aviso
        }
    }

    private static String reais(long centavos) {
        return "R$ %d,%02d".formatted(centavos / 100, centavos % 100);
    }
}
