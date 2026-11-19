package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import br.edu.ifsp.leilao.corrida.regra.RegraLance;
import org.springframework.jdbc.core.simple.JdbcClient;

public final class ArquiteturaCrud extends ArquiteturaLinha {
    public static final String ID = "crud";

    public ArquiteturaCrud(JdbcClient jdbc) {
        super(jdbc, ID, "CRUD simples", "Lê a linha, decide e faz UPDATE, sem controle de concorrência",
                "corrida_crud");
    }

    @Override
    public void preparar(LeilaoInicial inicial) {
        criarLinha(inicial);
        zerarContadores();
    }

    @Override
    public ResultadoLance darLance(String licitante, long valor) {
        EstadoLeilao atual = lerLinha(custos);
        if (!RegraLance.aceita(atual, valor)) {
            return new ResultadoLance(ResultadoLance.Tipo.RECUSADO, atual.versao(), atual.versao(), atual.precoAtual(), 0);
        }
        EstadoLeilao novo = atual.comLance(licitante, valor);

        custos.escritaBanco();
        jdbc.sql("UPDATE " + tabela + " SET preco_atual = ?, lider = ?, versao = ? WHERE id = ?")
                .params(novo.precoAtual(), novo.lider(), novo.versao(), leilao.leilaoId())
                .update();
        return new ResultadoLance(ResultadoLance.Tipo.ACEITO, atual.versao(), novo.versao(), valor, 0);
    }

    @Override
    public Leitura consultar() {
        return leitura(lerLinha(custosLeitura));
    }

    @Override
    public Espaco espaco() {
        return new Espaco(contarLinhas(tabela), 0, 0, bytes());
    }
}
