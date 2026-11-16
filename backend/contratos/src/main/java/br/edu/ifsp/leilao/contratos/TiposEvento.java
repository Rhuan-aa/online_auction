package br.edu.ifsp.leilao.contratos;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

public final class TiposEvento {
    public static final String LEILAO_CRIADO     = "LeilaoCriado.v1";
    public static final String LEILAO_INICIADO   = "LeilaoIniciado.v1";
    public static final String LANCE_REGISTRADO  = "LanceRegistrado.v1";
    public static final String LEILAO_PRORROGADO = "LeilaoProrrogado.v1";
    public static final String LEILAO_ENCERRADO  = "LeilaoEncerrado.v1";
    public static final String LEILAO_CANCELADO  = "LeilaoCancelado.v1";

    public static final List<String> TODOS = List.of(LEILAO_CRIADO, LEILAO_INICIADO, LANCE_REGISTRADO,
            LEILAO_PRORROGADO, LEILAO_ENCERRADO, LEILAO_CANCELADO);

    /** "LanceRegistrado.v1" -> LanceRegistrado.class, montado a partir dos eventos permitidos. */
    private static final Map<String, Class<? extends EventoLeilao>> CLASSE_POR_TIPO = Arrays
            .stream(EventoLeilao.class.getPermittedSubclasses())
            .map(classe -> classe.asSubclass(EventoLeilao.class))
            .collect(Collectors.toMap(TiposEvento::nomeDoTipo, Function.identity()));

    /** O nome gravado no Event Store: o nome do record + ".v1" (ex.: LanceRegistrado.v1). */
    public static String de(EventoLeilao evento) {
        return nomeDoTipo(evento.getClass());
    }

    /** O caminho inverso de {@link #de}: a classe usada para ler um evento gravado. */
    public static Class<? extends EventoLeilao> classeDe(String tipo) {
        return CLASSE_POR_TIPO.get(tipo);
    }

    private static String nomeDoTipo(Class<?> classe) {
        return classe.getSimpleName() + ".v1";
    }

    private TiposEvento() {}
}
