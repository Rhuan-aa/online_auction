package br.edu.ifsp.leilao.contratos;

import java.time.Instant;
import java.util.UUID;

/**
 * Envelope para publicação e consumo de eventos no Kafka.
 *
 * @param id sequência global do evento (1, 2, 3...)
 * @param leilaoId identificador do leilão
 * @param versao versão do leilão após o evento (1..n)
 * @param tipo nome do evento (ex: EventTypes.AUCTION_CREATED)
 * @param criadoEm momento em que o evento ocorreu
 * @param dados payload com os dados de negócio do evento
 */
public record EventEnvelope<P>(long id, UUID leilaoId, int versao, String tipo,
                               Instant criadoEm, P dados) {}
