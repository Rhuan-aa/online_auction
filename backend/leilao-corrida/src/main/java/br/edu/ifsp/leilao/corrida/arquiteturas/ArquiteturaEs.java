package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Event Sourcing puro: cada lance e cada consulta relê todos os eventos. O custo cresce com o leilão. */
public final class ArquiteturaEs extends ArquiteturaEventos {

    public static final String ID = "es";

    public ArquiteturaEs(JdbcClient jdbc) {
        super(jdbc, ID, "Event Sourcing puro", "Eventos imutáveis; relê todos a cada lance e consulta",
                "corrida_es", List.of());
    }

    @Override
    protected EstadoLeilao carregarParaEscrita(Contadores c) {
        return replayCompleto(c);
    }

    @Override
    public Leitura consultar() {
        return leitura(replayCompleto(custosLeitura));
    }
}
