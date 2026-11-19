package br.edu.ifsp.leilao.estado;

import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class Checkpoint {
    private static final Logger log = LoggerFactory.getLogger(Checkpoint.class);

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final int aCadaEventos;

    private final ConfiguracaoAtiva configuracao;

    public Checkpoint(JdbcClient jdbc, JsonMapper json,
                      @Value("${leilao.checkpoint.a-cada-eventos:50}") int aCadaEventos,
                      ConfiguracaoAtiva configuracao) {
        this.jdbc = jdbc;
        this.json = json;
        this.aCadaEventos = aCadaEventos;
        this.configuracao = configuracao;
    }

    private boolean ligado() {
        return configuracao.atual().usaCheckpoint();
    }

    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        if (!ligado()) {
            return Optional.empty();
        }
        return jdbc.sql("SELECT estado FROM checkpoint.estados WHERE leilao_id = ? AND schema_version = ?")
                .params(leilaoId, EstadoLeilao.SCHEMA_VERSION)
                .query((rs, linha) -> json.readValue(rs.getString("estado"), EstadoLeilao.class))
                .optional();
    }

    public void gravarSeNecessario(UUID leilaoId, int versaoAnterior, EstadoLeilao atual) {
        if (!ligado() || !deveGravar(versaoAnterior, atual, aCadaEventos)) {
            return;
        }
        try {
            gravar(leilaoId, atual);
        } catch (RuntimeException e) {
            log.warn("Não foi possível gravar o checkpoint do leilão {}: {}", leilaoId, e.toString());
        }
    }

    static boolean deveGravar(int versaoAnterior, EstadoLeilao atual, int aCadaEventos) {
        boolean passouDeUmMultiplo = atual.versao() / aCadaEventos > versaoAnterior / aCadaEventos;
        return passouDeUmMultiplo || atual.terminou();
    }

    public int apagarTodos() {
        return jdbc.sql("DELETE FROM checkpoint.estados").update();
    }

    void gravar(UUID leilaoId, EstadoLeilao estado) {
        jdbc.sql("""
                        INSERT INTO checkpoint.estados (leilao_id, versao, schema_version, estado)
                        VALUES (?, ?, ?, ?::jsonb)
                        ON CONFLICT (leilao_id) DO UPDATE
                          SET versao = EXCLUDED.versao, schema_version = EXCLUDED.schema_version,
                              estado = EXCLUDED.estado, gravado_em = now()
                          WHERE checkpoint.estados.versao < EXCLUDED.versao""")
                .params(leilaoId, estado.versao(), EstadoLeilao.SCHEMA_VERSION, json.writeValueAsString(estado))
                .update();
    }
}
