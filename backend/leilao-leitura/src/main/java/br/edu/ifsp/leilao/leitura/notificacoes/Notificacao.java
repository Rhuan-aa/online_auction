package br.edu.ifsp.leilao.leitura.notificacoes;

import java.util.UUID;

/** Um aviso para uma pessoa sobre um leilão; o tipo deixa quem exibe escolher o destaque sem ler o texto. */
public record Notificacao(String destinatarioId, UUID leilaoId, Tipo tipo, String mensagem) {
    public enum Tipo { SUPERADO, VENCEU, VENDEU, SEM_LANCES }
}
