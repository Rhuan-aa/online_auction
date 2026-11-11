package br.edu.ifsp.leilao.contratos;

/** Tópicos Kafka. Mensagem: key = leilaoId, value = JSON do {@link EnvelopeEvento}. */
public final class Topicos {
    public static final String EVENTOS_LEILAO     = "leilao.eventos";
    public static final String COMANDOS_AGENDADOR = "leilao.comandos-agendador";

    private Topicos() {}
}
