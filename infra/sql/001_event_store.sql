CREATE SCHEMA IF NOT EXISTS event_store;

CREATE TABLE event_store.eventos (
  id            BIGSERIAL PRIMARY KEY,
  leilao_id     UUID        NOT NULL,
  versao        INT         NOT NULL,
  tipo          TEXT        NOT NULL,
  dados         JSONB       NOT NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (leilao_id, versao)
);

CREATE TABLE event_store.outbox (
  id            BIGSERIAL PRIMARY KEY,
  evento_id     BIGINT      NOT NULL REFERENCES event_store.eventos(id),
  publicado_em  TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pendentes ON event_store.outbox (id) WHERE publicado_em IS NULL;

-- append-only
CREATE OR REPLACE FUNCTION event_store.proibir_mutacao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_store.eventos é append-only (% não permitido)', TG_OP;
END $$;

CREATE TRIGGER eventos_append_only
  BEFORE UPDATE OR DELETE ON event_store.eventos
  FOR EACH ROW EXECUTE FUNCTION event_store.proibir_mutacao();
