-- senha = nome do usuário (apenas dev)
CREATE USER command_svc   PASSWORD 'command_svc';
CREATE USER projector_svc PASSWORD 'projector_svc';
CREATE USER query_svc     PASSWORD 'query_svc';

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE leilao FROM PUBLIC;
GRANT CONNECT ON DATABASE leilao TO command_svc, projector_svc, query_svc;

-- command_svc: só event_store
GRANT USAGE ON SCHEMA event_store TO command_svc;
GRANT SELECT, INSERT ON event_store.events, event_store.outbox TO command_svc;
GRANT UPDATE ON event_store.outbox TO command_svc;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA event_store TO command_svc;

-- projector_svc: read_model completo + SELECT em events (replay)
GRANT USAGE ON SCHEMA event_store, read_model TO projector_svc;
GRANT SELECT ON event_store.events TO projector_svc;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA read_model TO projector_svc;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA read_model TO projector_svc;

-- query_svc: só leitura do read_model
GRANT USAGE ON SCHEMA read_model TO query_svc;
GRANT SELECT ON ALL TABLES IN SCHEMA read_model TO query_svc;
