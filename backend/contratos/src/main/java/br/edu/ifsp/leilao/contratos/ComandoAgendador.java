package br.edu.ifsp.leilao.contratos;

import java.time.Instant;
import java.util.UUID;

/** @param tipo IniciarLeilao | EncerrarLeilao */
public record ComandoAgendador(String tipo, UUID leilaoId, Instant emitidoEm) {}

