package br.edu.ifsp.leilao.contratos;

import java.util.List;

public final class TiposEvento {
    public static final String LEILAO_CRIADO     = "LeilaoCriado.v1";
    public static final String LEILAO_INICIADO   = "LeilaoIniciado.v1";
    public static final String LANCE_REGISTRADO  = "LanceRegistrado.v1";
    public static final String LEILAO_PRORROGADO = "LeilaoProrrogado.v1";
    public static final String LEILAO_ENCERRADO  = "LeilaoEncerrado.v1";
    public static final String LEILAO_CANCELADO  = "LeilaoCancelado.v1";

    public static final List<String> TODOS = List.of(LEILAO_CRIADO, LEILAO_INICIADO, LANCE_REGISTRADO,
            LEILAO_PRORROGADO, LEILAO_ENCERRADO, LEILAO_CANCELADO);

    private TiposEvento() {}
}
