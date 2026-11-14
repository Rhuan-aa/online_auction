-- Checkpoint: cópia durável do estado de cada leilão (ADR-003).
-- É derivada dos eventos: pode ser apagada e refeita a qualquer momento.
-- Roda depois do 003_roles.sql porque concede permissões aos usuários criados lá.
CREATE SCHEMA IF NOT EXISTS checkpoint;

CREATE TABLE checkpoint.estados (
  leilao_id      UUID        PRIMARY KEY,
  versao         INT         NOT NULL,  -- versão do leilão neste estado (= nº de eventos aplicados)
  schema_version INT         NOT NULL,  -- formato do JSON (EstadoLeilao.SCHEMA_VERSION)
  estado         JSONB       NOT NULL,
  gravado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- command_svc (escrita): grava e apaga; query_svc (leitura): só lê.
GRANT USAGE ON SCHEMA checkpoint TO command_svc, query_svc;
GRANT SELECT, INSERT, UPDATE, DELETE ON checkpoint.estados TO command_svc;
GRANT SELECT ON checkpoint.estados TO query_svc;

-- Temporário: enquanto as projeções existem, a leitura conecta como projector_svc.
-- Sai junto com o read_model (etapa 9), quando a leitura passa a usar o query_svc.
GRANT USAGE ON SCHEMA checkpoint TO projector_svc;
GRANT SELECT ON checkpoint.estados TO projector_svc;
