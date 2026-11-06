CREATE SCHEMA read_model;

-- valores monetários em centavos (BIGINT)
CREATE TABLE read_model.auction_catalog (
  auction_id     UUID PRIMARY KEY,
  seller_id      TEXT        NOT NULL,
  title          TEXT        NOT NULL,
  status         TEXT        NOT NULL,
  starting_price BIGINT      NOT NULL,
  current_price  BIGINT,
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  winner_id      TEXT,
  last_version   INT         NOT NULL
);
CREATE INDEX auction_catalog_status_ends_at ON read_model.auction_catalog (status, ends_at);

CREATE TABLE read_model.bid_history (
  auction_id UUID,
  version    INT         NOT NULL,
  bidder_id  TEXT        NOT NULL,
  amount     BIGINT      NOT NULL,
  placed_at  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (auction_id, version)
);

CREATE TABLE read_model.bidder_activity (
  bidder_id       TEXT,
  auction_id      UUID,
  last_bid_amount BIGINT      NOT NULL,
  last_bid_at     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bidder_id, auction_id)
);
