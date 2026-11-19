package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import br.edu.ifsp.leilao.corrida.regra.RegraLance;
import java.util.ArrayList;
import java.util.List;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;

abstract class ArquiteturaEventos extends ArquiteturaBase {
    protected static final String CRIADO = "LeilaoCriado";
    protected static final String LANCE = "LanceAceito";

    protected final String eventos;
    private final List<String> outrasTabelas;

    ArquiteturaEventos(JdbcClient jdbc, String id, String nome, String descricao, String schema,
                       List<String> outrasTabelas) {
        super(jdbc, id, nome, descricao, tabelas(schema, outrasTabelas));
        this.eventos = schema + ".eventos";
        this.outrasTabelas = outrasTabelas.stream().map(t -> schema + "." + t).toList();
    }

    private static List<String> tabelas(String schema, List<String> outras) {
        List<String> todas = new ArrayList<>();
        todas.add(schema + ".eventos");
        outras.forEach(t -> todas.add(schema + "." + t));
        return todas;
    }

    protected abstract EstadoLeilao carregarParaEscrita(Contadores c);

    protected void aposGravar(EstadoLeilao novo, Contadores c) {}

    protected void aposPreparar(EstadoLeilao inicial) {}

    protected long chavesRedis() {
        return 0;
    }

    @Override
    public void preparar(LeilaoInicial inicial) {
        apagarTabelas();
        this.leilao = inicial;
        jdbc.sql("INSERT INTO " + eventos + " (leilao_id, versao, tipo, licitante, valor, incremento) VALUES (?, 1, ?, NULL, ?, ?)")
                .params(inicial.leilaoId(), CRIADO, inicial.precoInicial(), inicial.incremento())
                .update();
        aposPreparar(estadoInicial());
        zerarContadores();
    }

    @Override
    public ResultadoLance darLance(String licitante, long valor) {
        EstadoLeilao atual = null;
        for (int tentativa = 1; tentativa <= ResultadoLance.MAX_TENTATIVAS; tentativa++) {
            atual = carregarParaEscrita(custos);
            if (!RegraLance.aceita(atual, valor)) {
                return new ResultadoLance(ResultadoLance.Tipo.RECUSADO, atual.versao(), atual.versao(),
                        atual.precoAtual(), tentativa - 1);
            }
            EstadoLeilao novo = atual.comLance(licitante, valor);
            if (anexar(novo, custos)) {
                aposGravar(novo, custos);
                return new ResultadoLance(ResultadoLance.Tipo.ACEITO, atual.versao(), novo.versao(), valor, tentativa - 1);
            }
        }
        return new ResultadoLance(ResultadoLance.Tipo.CONFLITO, atual.versao(), atual.versao(), atual.precoAtual(),
                ResultadoLance.MAX_TENTATIVAS - 1);
    }

    protected boolean anexar(EstadoLeilao novo, Contadores c) {
        c.escritaBanco();
        try {
            jdbc.sql("INSERT INTO " + eventos + " (leilao_id, versao, tipo, licitante, valor) VALUES (?, ?, ?, ?, ?)")
                    .params(leilao.leilaoId(), novo.versao(), LANCE, novo.lider(), novo.precoAtual())
                    .update();
            return true;
        } catch (DuplicateKeyException conflito) {
            return false;
        }
    }

    protected EstadoLeilao replayCompleto(Contadores c) {
        return aplicarEventos(null, 0, c);
    }

    protected EstadoLeilao aplicarEventos(EstadoLeilao base, int depoisDe, Contadores c) {
        c.leituraBanco();
        List<Evento> lidos = jdbc.sql("SELECT versao, tipo, licitante, valor, incremento FROM " + eventos
                        + " WHERE leilao_id = ? AND versao > ? ORDER BY versao")
                .params(leilao.leilaoId(), depoisDe)
                .query((rs, n) -> new Evento(rs.getInt("versao"), rs.getString("tipo"), rs.getString("licitante"),
                        rs.getLong("valor"), rs.getLong("incremento")))
                .list();
        EstadoLeilao estado = base;
        for (Evento e : lidos) {
            estado = CRIADO.equals(e.tipo())
                    ? EstadoLeilao.criado(e.valor(), e.incremento())
                    : estado.aplicarLance(e.licitante(), e.valor(), e.versao());
        }
        if (estado == null) {
            throw new IllegalStateException("Leilão sem o evento LeilaoCriado em " + eventos);
        }
        return estado;
    }

    @Override
    public Leitura estadoFinal() {
        return leitura(replayCompleto(Contadores.descartavel()));
    }

    @Override
    public Espaco espaco() {
        long linhas = 0;
        for (String t : outrasTabelas) {
            linhas += contarLinhas(t);
        }
        return new Espaco(linhas, contarLinhas(eventos), chavesRedis(), bytes());
    }

    @Override
    public Auditoria auditoria() {
        return new Auditoria(true, contarLinhas(eventos));
    }

    protected record Evento(int versao, String tipo, String licitante, long valor, long incremento) {}
}
