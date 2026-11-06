package br.edu.ifsp.leilao.contracts;

import java.time.Instant;

/** Payloads dos eventos. Dinheiro em centavos (long); datas em Instant; ids de usuário String. */
public sealed interface AuctionEventPayload {
    record AuctionCreated(String sellerId, String title, long startingPrice, long minIncrement,
                          Instant startsAt, Instant endsAt) implements AuctionEventPayload {}
    record AuctionStarted(Instant endsAt) implements AuctionEventPayload {}
    record BidPlaced(String bidderId, long amount) implements AuctionEventPayload {}
    record AuctionExtended(Instant newEndsAt) implements AuctionEventPayload {}
    /** winnerId e winningAmount nulos quando não houve lance. */
    record AuctionClosed(String winnerId, Long winningAmount) implements AuctionEventPayload {}
    record AuctionCancelled(String reason) implements AuctionEventPayload {}
}
