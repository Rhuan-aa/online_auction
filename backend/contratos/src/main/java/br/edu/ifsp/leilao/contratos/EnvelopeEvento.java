package br.edu.ifsp.leilao.contratos;

import java.time.Instant;
import java.util.UUID;

public record EnvelopeEvento<P>(long id, UUID leilaoId, int versao, String tipo,
                               Instant criadoEm, P dados) {}
