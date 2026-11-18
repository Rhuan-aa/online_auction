package br.edu.ifsp.leilao.corrida.motor;

import tools.jackson.databind.JsonNode;

/**
 * Valida o corpo do POST /corrida. Sem limite máximo (o contrato não tem), só inteiros: os 4
 * contadores >= 1 (leitores >= 0), preço inicial e incremento >= 1. Rejeita o que não cabe nos
 * tipos (int nos contadores e no total de lances; long nos valores que o plano pode atingir).
 * {@code semente} é opcional (não faz parte do contrato da tela; útil para repetir um plano).
 */
public final class ValidadorParametros {

    private ValidadorParametros() {}

    public record Pedido(Parametros parametros, long semente) {}

    public static class ParametroInvalidoException extends RuntimeException {
        public ParametroInvalidoException(String mensagem) {
            super(mensagem);
        }
    }

    public static Pedido validar(JsonNode corpo, long sementePadrao) {
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
            // Pior caso do plano: cada lance sobe 50 incrementos (e ainda acompanha o preço).
            long passoMax = Math.multiplyExact(incremento, 50L);
            Math.addExact(precoInicial, Math.multiplyExact(passoMax, 2L * licitantes * (long) lances));
        } catch (ArithmeticException e) {
            throw new ParametroInvalidoException("Valores grandes demais: o plano de lances não cabe em números de 64 bits.");
        }
        return new Pedido(new Parametros(licitantes, lances, simultaneos, leitores, precoInicial, incremento), semente);
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
