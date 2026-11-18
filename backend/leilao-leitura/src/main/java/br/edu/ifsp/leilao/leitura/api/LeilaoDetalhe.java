package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

/**
 * Resposta de GET /leiloes/{id} e de cada mensagem do SSE (PLANO.md, seção 2.5).
 * O JSON tem os mesmos campos de antes; só o SSE acrescenta {@code evento} (tipo e versão do
 * evento que causou a mensagem). Fora do SSE o campo é nulo e some do JSON.
 */
public record LeilaoDetalhe(UUID leilaoId, String titulo, String status, Long precoAtual, String liderId,
                            Instant fimEm, int versao,
                            @JsonInclude(JsonInclude.Include.NON_NULL) EventoInfo evento) {

    public record EventoInfo(String tipo, int versao) {
    }

    static LeilaoDetalhe de(UUID leilaoId, EstadoLeilao estado) {
        return new LeilaoDetalhe(leilaoId, estado.titulo(), estado.status().name(), estado.precoAtual(),
                estado.liderId(), estado.fimEm(), estado.versao(), null);
    }

    LeilaoDetalhe comEvento(EventoInfo info) {
        return new LeilaoDetalhe(leilaoId, titulo, status, precoAtual, liderId, fimEm, versao, info);
    }
}
