package br.edu.ifsp.leilao.leitura.notificacoes;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import br.edu.ifsp.leilao.contratos.Topicos;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Component
public class Notificador {
    private static final TypeReference<EnvelopeEvento<JsonNode>> ENVELOPE = new TypeReference<>() {};

    private record Acompanhamento(String titulo, String vendedorId, String liderId, int versao) {}

    private final Map<UUID, Acompanhamento> leiloes = new ConcurrentHashMap<>();
    private final List<CanalNotificacao> canais;
    private final JsonMapper json;

    public Notificador(List<CanalNotificacao> canais, JsonMapper json) {
        this.canais = List.copyOf(canais);
        this.json = json;
    }

    private void enviar(String para, UUID leilaoId, Notificacao.Tipo tipo, String mensagem) {
        Notificacao n = new Notificacao(para, leilaoId, tipo, mensagem);
        canais.forEach(canal -> canal.enviar(n));
    }

    @KafkaListener(topics = Topicos.EVENTOS_LEILAO, groupId = "leilao-leitura-notificacoes")
    public void receber(String mensagem) {
        processar(json.readValue(mensagem, ENVELOPE));
    }

    void processar(EnvelopeEvento<JsonNode> evento) {
        Acompanhamento atual = leiloes.get(evento.leilaoId());
        if (atual != null && evento.versao() <= atual.versao()) {
            return;
        }
        switch (evento.tipo()) {
            case TiposEvento.LEILAO_CRIADO -> aoCriar(evento);
            case TiposEvento.LANCE_REGISTRADO -> aoReceberLance(evento, atual);
            case TiposEvento.LEILAO_ENCERRADO -> aoEncerrar(evento, atual);
            default -> { }
        }
    }

    private void aoCriar(EnvelopeEvento<JsonNode> evento) {
        LeilaoCriado criado = json.treeToValue(evento.dados(), LeilaoCriado.class);
        leiloes.put(evento.leilaoId(), new Acompanhamento(criado.titulo(), criado.vendedorId(), null, evento.versao()));
    }

    private void aoReceberLance(EnvelopeEvento<JsonNode> evento, Acompanhamento atual) {
        if (atual == null) {
            return;
        }
        LanceRegistrado lance = json.treeToValue(evento.dados(), LanceRegistrado.class);
        if (atual.liderId() != null && !atual.liderId().equals(lance.licitanteId())) {
            enviar(atual.liderId(), evento.leilaoId(), Notificacao.Tipo.SUPERADO, "Seu lance no leilão \"%s\" foi superado: novo lance de %s"
                    .formatted(atual.titulo(), reais(lance.valor())));
        }
        leiloes.put(evento.leilaoId(),
                new Acompanhamento(atual.titulo(), atual.vendedorId(), lance.licitanteId(), evento.versao()));
    }

    private void aoEncerrar(EnvelopeEvento<JsonNode> evento, Acompanhamento atual) {
        if (atual == null) {
            return;
        }
        LeilaoEncerrado fim = json.treeToValue(evento.dados(), LeilaoEncerrado.class);
        if (fim.vencedorId() == null) {
            enviar(atual.vendedorId(), evento.leilaoId(), Notificacao.Tipo.SEM_LANCES, "Seu leilão \"%s\" terminou sem lances".formatted(atual.titulo()));
        } else {
            String valor = reais(fim.valorVencedor());
            enviar(fim.vencedorId(), evento.leilaoId(), Notificacao.Tipo.VENCEU, "Você venceu o leilão \"%s\" com %s".formatted(atual.titulo(), valor));
            enviar(atual.vendedorId(), evento.leilaoId(), Notificacao.Tipo.VENDEU, "Seu leilão \"%s\" terminou: %s venceu com %s"
                    .formatted(atual.titulo(), fim.vencedorId(), valor));
        }
        leiloes.remove(evento.leilaoId());
    }

    private static String reais(long centavos) {
        return "R$ %d,%02d".formatted(centavos / 100, centavos % 100);
    }
}
