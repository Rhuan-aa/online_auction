package br.edu.ifsp.leilao.contratos;

/** Tópicos Kafka. Mensagem: key = auctionId, value = JSON do {@link EventEnvelope}. */
public final class Topics {
    public static final String AUCTION_EVENTS = "auction.events";
    public static final String TIMER_COMMANDS = "auction.commands.timer";

    private Topics() {}
}
