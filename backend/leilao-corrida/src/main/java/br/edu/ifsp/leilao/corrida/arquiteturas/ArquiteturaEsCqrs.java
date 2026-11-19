package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

public final class ArquiteturaEsCqrs extends ArquiteturaEventos {
    public static final String ID = "es-cqrs";
    public static final String TOPICO = "corrida.cqrs";

    private static final String LEITURA = "corrida_es_cqrs.leitura";

    private final JdbcClient jdbcProjecao;
    private final KafkaTemplate<String, String> kafka;
    private final JsonMapper json;

    public ArquiteturaEsCqrs(JdbcClient jdbc, JdbcClient jdbcProjecao, KafkaTemplate<String, String> kafka,
                             JsonMapper json) {
        super(jdbc, ID, "ES + CQRS", "Grava eventos, publica no Kafka e lê de uma projeção", "corrida_es_cqrs",
                List.of("leitura"));
        this.jdbcProjecao = jdbcProjecao;
        this.kafka = kafka;
        this.json = json;
    }

    @Override
    protected void aposPreparar(EstadoLeilao inicial) {
        jdbc.sql("INSERT INTO " + LEITURA + " (leilao_id, rodada, versao, preco_atual, lider) VALUES (?, ?, ?, ?, NULL)")
                .params(leilao.leilaoId(), leilao.rodada(), inicial.versao(), inicial.precoAtual())
                .update();
    }

    @Override
    protected EstadoLeilao carregarParaEscrita(Contadores c) {
        return replayCompleto(c);
    }

    @Override
    protected void aposGravar(EstadoLeilao novo, Contadores c) {
        String mensagem = json.writeValueAsString(Map.of(
                "rodada", leilao.rodada().toString(),
                "leilaoId", leilao.leilaoId().toString(),
                "versao", novo.versao(),
                "licitante", novo.lider(),
                "valor", novo.precoAtual()));
        try {
            kafka.send(TOPICO, leilao.leilaoId().toString(), mensagem).get(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrompido publicando no Kafka", e);
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao publicar no Kafka: " + e.getMessage(), e);
        }
    }

    public void projetar(String mensagem) {
        JsonNode m = json.readTree(mensagem);
        int alteradas = jdbcProjecao.sql("UPDATE " + LEITURA + " SET versao = ?, preco_atual = ?, lider = ?, atualizado_em = now()"
                        + " WHERE leilao_id = ? AND rodada = ? AND versao < ?")
                .params(m.get("versao").asInt(), m.get("valor").asLong(), m.get("licitante").asString(),
                        UUID.fromString(m.get("leilaoId").asString()), UUID.fromString(m.get("rodada").asString()),
                        m.get("versao").asInt())
                .update();

        if (alteradas == 1) {
            custos.escritaBanco();
        }
    }

    @Override
    public Leitura consultar() {
        custosLeitura.leituraBanco();
        return jdbc.sql("SELECT preco_atual, lider, versao FROM " + LEITURA + " WHERE leilao_id = ?")
                .param(leilao.leilaoId())
                .query((rs, n) -> new Leitura(rs.getLong("preco_atual"), rs.getString("lider"), rs.getInt("versao")))
                .single();
    }
}
