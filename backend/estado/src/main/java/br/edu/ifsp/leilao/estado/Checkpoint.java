package br.edu.ifsp.leilao.estado;

import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cópia durável do estado no Postgres (tabela checkpoint.estados), ADR-003.
 *
 * O Redis é rápido, mas volátil: reinicia vazio e descarta chaves quando enche. Sem checkpoint,
 * um leilão longo fora do Redis teria de reler o histórico inteiro. Com ele, relê no máximo
 * os últimos N eventos.
 */
@Repository
public class Checkpoint {

    private static final Logger log = LoggerFactory.getLogger(Checkpoint.class);

    private final JdbcClient jdbc;
    private final JsonMapper json;
    private final int aCadaEventos;
    /** Na configuração A: sem checkpoint, como se a tabela estivesse vazia. */
    private final ConfiguracaoAtiva configuracao;

    /** N vem de leilao.checkpoint.a-cada-eventos (padrão 50), para ajustar nos experimentos A/B/C. */
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

    /** Só devolve checkpoints gravados no formato atual (EstadoLeilao.SCHEMA_VERSION). */
    public Optional<EstadoLeilao> ler(UUID leilaoId) {
        if (!ligado()) {
            return Optional.empty();
        }
        return jdbc.sql("SELECT estado FROM checkpoint.estados WHERE leilao_id = ? AND schema_version = ?")
                .params(leilaoId, EstadoLeilao.SCHEMA_VERSION)
                .query((rs, linha) -> json.readValue(rs.getString("estado"), EstadoLeilao.class))
                .optional();
    }

    /**
     * Chamado depois que novos eventos foram gravados. Grava só quando a versão passou de um
     * múltiplo de N ou quando o leilão terminou (o estado final fica guardado para sempre).
     *
     * Uma falha aqui só vira aviso no log: o lance já foi aceito (o commit aconteceu), e o
     * checkpoint é só uma otimização. Se lançasse exceção, o cliente receberia erro de um lance
     * que valeu e poderia repeti-lo.
     */
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

    /** Ex.: N = 50, de 49 para 51 eventos passou do 50: grava. De 51 para 52: não grava. */
    static boolean deveGravar(int versaoAnterior, EstadoLeilao atual, int aCadaEventos) {
        boolean passouDeUmMultiplo = atual.versao() / aCadaEventos > versaoAnterior / aCadaEventos;
        return passouDeUmMultiplo || atual.terminou();
    }

    /** Apaga todos os checkpoints (ferramenta de reconstrução). Devolve quantos apagou. */
    public int apagarTodos() {
        return jdbc.sql("DELETE FROM checkpoint.estados").update();
    }

    /** Só avança: um checkpoint mais antigo nunca sobrescreve um mais novo. */
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
