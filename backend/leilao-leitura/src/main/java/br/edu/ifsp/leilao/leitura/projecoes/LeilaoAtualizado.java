package br.edu.ifsp.leilao.leitura.projecoes;

import java.util.UUID;

/**
 * Aviso interno: "a projeção deste leilão acabou de mudar".
 * Quem quiser reagir (hoje, o SSE) escuta com @EventListener, sem a projeção saber que ele existe.
 */
public record LeilaoAtualizado(UUID leilaoId) {}
