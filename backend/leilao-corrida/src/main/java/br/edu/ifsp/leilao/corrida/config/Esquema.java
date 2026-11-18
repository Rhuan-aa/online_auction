package br.edu.ifsp.leilao.corrida.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Cria, na subida, um schema por arquitetura (CREATE ... IF NOT EXISTS). Roda antes dos
 * consumidores Kafka começarem (eles sobem depois do contexto pronto). Nada aqui toca nos schemas
 * do sistema real (event_store, checkpoint, read_model).
 */
@Component
public class Esquema implements InitializingBean {

    /** Tabela de eventos igual nas 4 variantes de Event Sourcing. UNIQUE(leilao_id, versao) é o controle de concorrência. */
    private static String eventos(String schema) {
        return """
                CREATE TABLE IF NOT EXISTS %s.eventos (
                  id          bigserial PRIMARY KEY,
                  leilao_id   uuid        NOT NULL,
                  versao      int         NOT NULL,
                  tipo        text        NOT NULL,
                  licitante   text,
                  valor       bigint      NOT NULL,
                  incremento  bigint,
                  criado_em   timestamptz NOT NULL DEFAULT now(),
                  UNIQUE (leilao_id, versao)
                )""".formatted(schema);
    }

    /** A linha única do leilão nas duas variantes CRUD. */
    private static String linhaLeilao(String schema) {
        return """
                CREATE TABLE IF NOT EXISTS %s.leilao (
                  id            uuid   PRIMARY KEY,
                  preco_inicial bigint NOT NULL,
                  incremento    bigint NOT NULL,
                  preco_atual   bigint NOT NULL,
                  lider         text,
                  versao        int    NOT NULL
                )""".formatted(schema);
    }

    static final String[] DDL = {
        "CREATE SCHEMA IF NOT EXISTS corrida_crud",
        linhaLeilao("corrida_crud"),
        "CREATE SCHEMA IF NOT EXISTS corrida_crud_cache",
        linhaLeilao("corrida_crud_cache"),
        "CREATE SCHEMA IF NOT EXISTS corrida_es",
        eventos("corrida_es"),
        "CREATE SCHEMA IF NOT EXISTS corrida_es_snapshot",
        eventos("corrida_es_snapshot"),
        """
        CREATE TABLE IF NOT EXISTS corrida_es_snapshot.snapshot (
          leilao_id     uuid   PRIMARY KEY,
          versao        int    NOT NULL,
          preco_inicial bigint NOT NULL,
          incremento    bigint NOT NULL,
          preco_atual   bigint NOT NULL,
          lider         text
        )""",
        "CREATE SCHEMA IF NOT EXISTS corrida_es_cache",
        eventos("corrida_es_cache"),
        "CREATE SCHEMA IF NOT EXISTS corrida_es_cqrs",
        eventos("corrida_es_cqrs"),
        """
        CREATE TABLE IF NOT EXISTS corrida_es_cqrs.leitura (
          leilao_id     uuid   PRIMARY KEY,
          rodada        uuid   NOT NULL,
          versao        int    NOT NULL,
          preco_atual   bigint NOT NULL,
          lider         text,
          atualizado_em timestamptz NOT NULL DEFAULT now()
        )""",
    };

    private final JdbcClient jdbc;

    public Esquema(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void afterPropertiesSet() {
        for (String sql : DDL) {
            jdbc.sql(sql).update();
        }
    }
}
