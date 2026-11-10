package br.edu.ifsp.leilao.contratos;

import java.util.List;

public final class EventTypes {
    public static final String AUCTION_CREATED = "AuctionCreated.v1";
    public static final String AUCTION_STARTED = "AuctionStarted.v1";
    public static final String BID_PLACED = "BidPlaced.v1";
    public static final String AUCTION_EXTENDED = "AuctionExtended.v1";
    public static final String AUCTION_CLOSED = "AuctionClosed.v1";
    public static final String AUCTION_CANCELLED = "AuctionCancelled.v1";

    public static final List<String> ALL = List.of(AUCTION_CREATED, AUCTION_STARTED, BID_PLACED,
            AUCTION_EXTENDED, AUCTION_CLOSED, AUCTION_CANCELLED);

    private EventTypes() {}
}
