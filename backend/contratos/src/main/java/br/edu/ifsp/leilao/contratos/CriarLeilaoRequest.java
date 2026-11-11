package br.edu.ifsp.leilao.contratos;

import java.time.Instant;

public record CriarLeilaoRequest(String vendedorId, String titulo, long precoInicial, long incrementoMinimo,
                                 Instant inicioEm, Instant fimEm) {}

