// espelho de backend/contratos — mudou lá, muda aqui
// Dinheiro em centavos; datas em string ISO-8601.

export const Topics = {
  AUCTION_EVENTS: 'auction.events',
  TIMER_COMMANDS: 'auction.commands.timer',
} as const

export const EventTypes = {
  AUCTION_CREATED: 'AuctionCreated.v1',
  AUCTION_STARTED: 'AuctionStarted.v1',
  BID_PLACED: 'BidPlaced.v1',
  AUCTION_EXTENDED: 'AuctionExtended.v1',
  AUCTION_CLOSED: 'AuctionClosed.v1',
  AUCTION_CANCELLED: 'AuctionCancelled.v1',
} as const

export interface AuctionCreated { sellerId: string; title: string; startingPrice: number; minIncrement: number; startsAt: string; endsAt: string }
export interface AuctionStarted { endsAt: string }
export interface BidPlaced { bidderId: string; amount: number }
export interface AuctionExtended { newEndsAt: string }
export interface AuctionClosed { winnerId: string | null; winningAmount: number | null }
export interface AuctionCancelled { reason: string }

export interface EventMetadata { correlationId: string; causationId: string; userId: string }

export interface EventEnvelope<P> {
  globalSeq: number
  aggregateId: string
  version: number // versão do agregado após o evento (1..n)
  type: string
  occurredAt: string
  payload: P
  metadata: EventMetadata
}

export type CreateAuctionRequest = AuctionCreated
export interface PlaceBidRequest { bidderId: string; amount: number }
