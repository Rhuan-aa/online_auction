package br.edu.ifsp.leilao.corrida.motor;

import tools.jackson.databind.JsonNode;

public final class ValidadorParametros {
    private ValidadorParametros() {}

    public record Pedido(Parametros parametros, long semente) {}

    public static class ParametroInvalidoException extends RuntimeException {
        public ParametroInvalidoException(String mensagem) {
            super(mensagem);
        }
    }

    public record Orcamento(int maxThreads, long maxLances) {
        public static final Orcamento PADRAO = new Orcamento(1_000_000, 2_000_000);
    }

    public static Pedido validar(JsonNode corpo, long sementePadrao) {
        return validar(corpo, sementePadrao, Orcamento.PADRAO);
    }

    public static Pedido validar(JsonNode corpo, long sementePadrao, Orcamento orcamento) {
        if (corpo == null || !corpo.isObject()) {
            throw new ParametroInvalidoException("O corpo deve ser um objeto JSON com os parâmetros da corrida.");
        }
        int licitantes = inteiro(corpo, "licitantes", 1);
        int lances = inteiro(corpo, "lancesPorLicitante", 1);
        int simultaneos = inteiro(corpo, "simultaneos", 1);
        int leitores = inteiro(corpo, "leitores", 0);
        long precoInicial = longo(corpo, "precoInicial");
        long incremento = longo(corpo, "incremento");
        long semente = corpo.hasNonNull("semente") ? semente(corpo.get("semente")) : sementePadrao;

        try {
            Math.multiplyExact(licitantes, lances);

            long passoMax = Math.multiplyExact(incremento, 50L);
            Math.addExact(precoInicial, Math.multiplyExact(passoMax, 2L * licitantes * (long) lances));
        } catch (ArithmeticException e) {
            throw new ParametroInvalidoException("Valores grandes demais: o plano de lances não cabe em números de 64 bits.");
        }
        verificarOrcamento(licitantes, lances, simultaneos, leitores, orcamento);
        return new Pedido(new Parametros(licitantes, lances, simultaneos, leitores, precoInicial, incremento), semente);
    }

    private static void verificarOrcamento(int licitantes, int lances, int simultaneos, int leitores,
                                           Orcamento orcamento) {
        long threads = 4L * ((long) simultaneos + leitores);
        if (threads > orcamento.maxThreads()) {
            throw new ParametroInvalidoException("Threads demais para esta máquina: " + threads
                    + " (4 arquiteturas x (simultâneos + leitores)); o limite é " + orcamento.maxThreads()
                    + ". Reduza os simultâneos ou os leitores.");
        }
        long total = (long) licitantes * lances;
        if (total > orcamento.maxLances()) {
            throw new ParametroInvalidoException("Lances demais para esta máquina: " + total
                    + " (licitantes x lances por licitante); o limite é " + orcamento.maxLances()
                    + ". Reduza os licitantes ou os lances por licitante.");
        }
    }

    private static JsonNode campo(JsonNode corpo, String nome) {
        JsonNode v = corpo.get(nome);
        if (v == null || v.isNull()) {
            throw new ParametroInvalidoException("Falta o campo \"" + nome + "\".");
        }
        if (!v.isIntegralNumber()) {
            throw new ParametroInvalidoException("\"" + nome + "\" deve ser um número inteiro.");
        }
        return v;
    }

    private static int inteiro(JsonNode corpo, String nome, int minimo) {
        JsonNode v = campo(corpo, nome);
        if (!v.canConvertToInt()) {
            throw new ParametroInvalidoException("\"" + nome + "\" é grande demais.");
        }
        int n = v.asInt();
        if (n < minimo) {
            throw new ParametroInvalidoException("\"" + nome + "\" deve ser >= " + minimo + ".");
        }
        return n;
    }

    private static long longo(JsonNode corpo, String nome) {
        JsonNode v = campo(corpo, nome);
        if (!v.canConvertToLong()) {
            throw new ParametroInvalidoException("\"" + nome + "\" é grande demais.");
        }
        long n = v.asLong();
        if (n < 1) {
            throw new ParametroInvalidoException("\"" + nome + "\" deve ser >= 1 (em centavos).");
        }
        return n;
    }

    private static long semente(JsonNode v) {
        if (!v.isIntegralNumber() || !v.canConvertToLong()) {
            throw new ParametroInvalidoException("\"semente\" deve ser um número inteiro.");
        }
        return v.asLong();
    }
}
