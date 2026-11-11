package br.edu.ifsp.leilao.leitura.projecoes;

import br.edu.ifsp.leilao.contratos.EnvelopeEvento;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import br.edu.ifsp.leilao.contratos.TiposEvento;
import java.sql.Timestamp;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Transforma cada evento em linhas prontas para as telas (schema read_model).
 *
 * Idempotente: o Kafka pode entregar o mesmo evento mais de uma vez, então eventos com
 * versão menor ou igual à última aplicada (catalogo_leiloes.ultima_versao) são ignorados.
 * A coluna vencedor_id guarda o líder atual; quando o leilão encerra, ele é o vencedor.
 */
@Repository
public class ProjecaoLeilao {

    private final JdbcClient jdbc;
    private final JsonMapper json;

    public ProjecaoLeilao(JdbcClient jdbc, JsonMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Transactional
    public void aplicar(EnvelopeEvento<JsonNode> evento) {
        UUID leilaoId = evento.leilaoId();

        if (TiposEvento.LEILAO_CRIADO.equals(evento.tipo())) {
            criar(leilaoId, evento.versao(), json.treeToValue(evento.dados(), LeilaoCriado.class));
            return;
        }

        Integer ultimaVersao = jdbc.sql("SELECT ultima_versao FROM read_model.catalogo_leiloes WHERE leilao_id = ? FOR UPDATE")
                .param(leilaoId).query(Integer.class).optional().orElse(null);
        if (ultimaVersao == null || evento.versao() <= ultimaVersao) {
            return; // leilão desconhecido ou evento repetido
        }

        switch (evento.tipo()) {
            case TiposEvento.LEILAO_INICIADO -> mudarStatus(leilaoId, "ABERTO");
            case TiposEvento.LANCE_REGISTRADO ->
                    registrarLance(leilaoId, evento, json.treeToValue(evento.dados(), LanceRegistrado.class));
            case TiposEvento.LEILAO_PRORROGADO -> {
                LeilaoProrrogado prorrogado = json.treeToValue(evento.dados(), LeilaoProrrogado.class);
                jdbc.sql("UPDATE read_model.catalogo_leiloes SET fim_em = ? WHERE leilao_id = ?")
                        .params(Timestamp.from(prorrogado.novoFimEm()), leilaoId).update();
            }
            case TiposEvento.LEILAO_ENCERRADO -> mudarStatus(leilaoId, "ENCERRADO");
            case TiposEvento.LEILAO_CANCELADO -> mudarStatus(leilaoId, "CANCELADO");
            default -> { }
        }

        jdbc.sql("UPDATE read_model.catalogo_leiloes SET ultima_versao = ? WHERE leilao_id = ?")
                .params(evento.versao(), leilaoId).update();
    }

    private void criar(UUID leilaoId, int versao, LeilaoCriado c) {
        jdbc.sql("""
                        INSERT INTO read_model.catalogo_leiloes
                          (leilao_id, vendedor_id, titulo, status, preco_inicial, preco_atual, inicio_em, fim_em, ultima_versao)
                        VALUES (?, ?, ?, 'CRIADO', ?, ?, ?, ?, ?)
                        ON CONFLICT (leilao_id) DO NOTHING""")
                .params(leilaoId, c.vendedorId(), c.titulo(), c.precoInicial(), c.precoInicial(),
                        Timestamp.from(c.inicioEm()), Timestamp.from(c.fimEm()), versao)
                .update();
    }

    private void registrarLance(UUID leilaoId, EnvelopeEvento<JsonNode> evento, LanceRegistrado lance) {
        Timestamp quando = Timestamp.from(evento.criadoEm());
        jdbc.sql("UPDATE read_model.catalogo_leiloes SET preco_atual = ?, vencedor_id = ? WHERE leilao_id = ?")
                .params(lance.valor(), lance.licitanteId(), leilaoId).update();
        jdbc.sql("""
                        INSERT INTO read_model.historico_lances (leilao_id, versao, licitante_id, valor, criado_em)
                        VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING""")
                .params(leilaoId, evento.versao(), lance.licitanteId(), lance.valor(), quando).update();
        jdbc.sql("""
                        INSERT INTO read_model.atividade_licitantes (licitante_id, leilao_id, ultimo_valor, ultimo_lance_em)
                        VALUES (?, ?, ?, ?)
                        ON CONFLICT (licitante_id, leilao_id)
                        DO UPDATE SET ultimo_valor = EXCLUDED.ultimo_valor, ultimo_lance_em = EXCLUDED.ultimo_lance_em""")
                .params(lance.licitanteId(), leilaoId, lance.valor(), quando).update();
    }

    private void mudarStatus(UUID leilaoId, String status) {
        jdbc.sql("UPDATE read_model.catalogo_leiloes SET status = ? WHERE leilao_id = ?").params(status, leilaoId).update();
    }
}
