package br.edu.ifsp.leilao.contracts;

import java.time.Instant;
import java.util.UUID;

/** @param type StartAuction | CloseAuction */
public record TimerCommand(String type, UUID auctionId, Instant issuedAt) {}
