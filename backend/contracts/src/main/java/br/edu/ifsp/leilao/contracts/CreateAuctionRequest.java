package br.edu.ifsp.leilao.contracts;

import java.time.Instant;

public record CreateAuctionRequest(String sellerId, String title, long startingPrice, long minIncrement,
                                   Instant startsAt, Instant endsAt) {}
