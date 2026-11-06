CREATE SCHEMA event_store;

CREATE TABLE event_store.events (
  global_seq   BIGSERIAL PRIMARY KEY,
  aggregate_id UUID        NOT NULL,
  version      INT         NOT NULL,
  type         TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  metadata     JSONB       NOT NULL, -- correlationId, causationId, userId
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (aggregate_id, version)
);

CREATE TABLE event_store.outbox (
  id               BIGSERIAL PRIMARY KEY,
  event_global_seq BIGINT NOT NULL REFERENCES event_store.events(global_seq),
  published_at     TIMESTAMPTZ
);

CREATE INDEX outbox_pending ON event_store.outbox (id) WHERE published_at IS NULL;

-- append-only
CREATE FUNCTION event_store.forbid_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'event_store.events is append-only (% not allowed)', TG_OP;
END $$;

CREATE TRIGGER events_append_only
  BEFORE UPDATE OR DELETE ON event_store.events
  FOR EACH ROW EXECUTE FUNCTION event_store.forbid_mutation();
