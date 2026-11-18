package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Base das duas variantes CRUD: o leilão é uma linha só, {@code <schema>.leilao}, sobrescrita a cada lance. */
abstract class ArquiteturaLinha extends ArquiteturaBase {

    protected final String tabela;

    ArquiteturaLinha(JdbcClient jdbc, String id, String nome, String descricao, String schema) {
        super(jdbc, id, nome, descricao, List.of(schema + ".leilao"));
        this.tabela = schema + ".leilao";
    }

    protected void criarLinha(LeilaoInicial inicial) {
        apagarTabelas();
        this.leilao = inicial;
        jdbc.sql("INSERT INTO " + tabela
                        + " (id, preco_inicial, incremento, preco_atual, lider, versao) VALUES (?, ?, ?, ?, NULL, 1)")
                .params(inicial.leilaoId(), inicial.precoInicial(), inicial.incremento(), inicial.precoInicial())
                .update();
    }

    protected EstadoLeilao lerLinha(Contadores c) {
        c.leituraBanco();
        return jdbc.sql("SELECT preco_inicial, incremento, preco_atual, lider, versao FROM " + tabela + " WHERE id = ?")
                .param(leilao.leilaoId())
                .query((rs, n) -> new EstadoLeilao(rs.getLong("preco_inicial"), rs.getLong("incremento"),
                        rs.getLong("preco_atual"), rs.getString("lider"), rs.getInt("versao"), true))
                .single();
    }

    @Override
    public Leitura estadoFinal() {
        return leitura(lerLinha(Contadores.descartavel()));
    }

    @Override
    public Auditoria auditoria() {
        return new Auditoria(false, 0); // a linha guarda só o último valor: o histórico se perde
    }
}
