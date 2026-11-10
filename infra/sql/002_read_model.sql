CREATE SCHEMA IF NOT EXISTS read_model;

-- valores monetários em centavos (BIGINT)
CREATE TABLE read_model.catalogo_leiloes (
  leilao_id         UUID PRIMARY KEY,
  vendedor_id       TEXT        NOT NULL,
  titulo            TEXT        NOT NULL,
  status            TEXT        NOT NULL,
  preco_inicial     BIGINT      NOT NULL,
  preco_atual       BIGINT,
  inicio_em         TIMESTAMPTZ NOT NULL,
  fim_em            TIMESTAMPTZ NOT NULL,
  vencedor_id       TEXT,
  ultima_versao     INT         NOT NULL
);
CREATE INDEX catalogo_leiloes_status_fim_em ON read_model.catalogo_leiloes (status, fim_em);

CREATE TABLE read_model.historico_lances (
  leilao_id  UUID,
  versao     INT         NOT NULL,
  licitante_id TEXT      NOT NULL,
  valor      BIGINT      NOT NULL,
  criado_em  TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (leilao_id, versao)
);

CREATE TABLE read_model.atividade_licitantes (
  licitante_id      TEXT,
  leilao_id         UUID,
  ultimo_valor      BIGINT      NOT NULL,
  ultimo_lance_em   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (licitante_id, leilao_id)
);
