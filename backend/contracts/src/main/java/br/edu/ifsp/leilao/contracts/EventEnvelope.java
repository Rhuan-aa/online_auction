package br.edu.ifsp.leilao.contracts;

import java.time.Instant;
import java.util.UUID;

/** @param version versão do agregado após o evento (1..n) */
public record EventEnvelope<P>(long globalSeq, UUID aggregateId, int version, String type,
                               Instant occurredAt, P payload, EventMetadata metadata) {}
