package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;

/** O que as 6 têm em comum: identidade, conexão própria, contadores e as medidas de espaço. */
abstract class ArquiteturaBase implements Arquitetura {

    protected final JdbcClient jdbc;
    protected final Contadores custos = new Contadores();
    protected final Contadores custosLeitura = new Contadores();
    protected volatile LeilaoInicial leilao;

    private final String id;
    private final String nome;
    private final String descricao;
    /** Tabelas da arquitetura, com schema (ex.: corrida_es.eventos). */
    private final List<String> tabelas;

    ArquiteturaBase(JdbcClient jdbc, String id, String nome, String descricao, List<String> tabelas) {
        this.jdbc = jdbc;
        this.id = id;
        this.nome = nome;
        this.descricao = descricao;
        this.tabelas = tabelas;
    }

    @Override
    public final String id() {
        return id;
    }

    @Override
    public final String nome() {
        return nome;
    }

    @Override
    public final String descricao() {
        return descricao;
    }

    @Override
    public Contadores custos() {
        return custos;
    }

    @Override
    public Contadores custosLeitura() {
        return custosLeitura;
    }

    @Override
    public LeilaoInicial leilao() {
        return leilao;
    }

    /** TRUNCATE de todas as tabelas da arquitetura (e só delas). */
    protected void apagarTabelas() {
        jdbc.sql("TRUNCATE " + String.join(", ", tabelas) + " RESTART IDENTITY").update();
    }

    protected void zerarContadores() {
        custos.zerar();
        custosLeitura.zerar();
    }

    protected EstadoLeilao estadoInicial() {
        LeilaoInicial l = leilao;
        return EstadoLeilao.criado(l.precoInicial(), l.incremento());
    }

    /** Soma de pg_total_relation_size (dados + índices + TOAST) das tabelas da arquitetura. */
    protected long bytes() {
        long total = 0;
        for (String tabela : tabelas) {
            total += jdbc.sql("SELECT pg_total_relation_size(CAST(? AS regclass))").param(tabela)
                    .query(Long.class).single();
        }
        return total;
    }

    protected long contarLinhas(String tabela) {
        return jdbc.sql("SELECT count(*) FROM " + tabela).query(Long.class).single();
    }

    protected static Leitura leitura(EstadoLeilao e) {
        return new Leitura(e.precoAtual(), e.lider(), e.versao());
    }
}
