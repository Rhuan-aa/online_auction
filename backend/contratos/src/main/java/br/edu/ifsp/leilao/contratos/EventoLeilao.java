package br.edu.ifsp.leilao.contratos;

import java.time.Instant;

public sealed interface EventoLeilao {
    record LeilaoCriado(String vendedorId, String titulo, long precoInicial, long incrementoMinimo,
                        Instant inicioEm, Instant fimEm) implements EventoLeilao {}
    record LeilaoIniciado(Instant fimEm) implements EventoLeilao {}
    record LanceRegistrado(String licitanteId, long valor) implements EventoLeilao {}
    record LeilaoProrrogado(Instant novoFimEm) implements EventoLeilao {}

    record LeilaoEncerrado(String vencedorId, Long valorVencedor) implements EventoLeilao {}
    record LeilaoCancelado(String motivo) implements EventoLeilao {}
}
