package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import java.time.Instant;
import java.util.UUID;

/**
 * Resposta de GET /leiloes/{id} e de cada mensagem do SSE (PLANO.md, seção 2.5).
 * O JSON tem os mesmos campos de antes: o front não precisa mudar.
 */
public record LeilaoDetalhe(UUID leilaoId, String titulo, String status, Long precoAtual, String liderId,
                            Instant fimEm, int versao) {

    static LeilaoDetalhe de(UUID leilaoId, EstadoLeilao estado) {
        return new LeilaoDetalhe(leilaoId, estado.titulo(), estado.status().name(), estado.precoAtual(),
                estado.liderId(), estado.fimEm(), estado.versao());
    }
}
