-- senha = nome do usuário (apenas dev)
CREATE USER command_svc   PASSWORD 'command_svc';
CREATE USER query_svc     PASSWORD 'query_svc';

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE CONNECT ON DATABASE leilao FROM PUBLIC;
GRANT CONNECT ON DATABASE leilao TO command_svc, query_svc;

-- command_svc (escrita): grava eventos e outbox; nunca altera nem apaga um evento
GRANT USAGE ON SCHEMA event_store TO command_svc;
GRANT SELECT, INSERT ON event_store.eventos, event_store.outbox TO command_svc;
GRANT UPDATE ON event_store.outbox TO command_svc;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA event_store TO command_svc;

-- query_svc (leitura): só lê os eventos, para completar a cópia do estado e montar os históricos
GRANT USAGE ON SCHEMA event_store TO query_svc;
GRANT SELECT ON event_store.eventos TO query_svc;
