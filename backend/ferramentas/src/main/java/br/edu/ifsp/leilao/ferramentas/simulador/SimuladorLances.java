package br.edu.ifsp.leilao.ferramentas.simulador;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.Executors;
import tools.jackson.databind.json.JsonMapper;

public class SimuladorLances {
    private static final String URL_ESCRITA = System.getenv().getOrDefault("URL_ESCRITA", "http://localhost:8081");
    private static final String URL_LEITURA = System.getenv().getOrDefault("URL_LEITURA", "http://localhost:8082");
    private static final long INCREMENTO_PADRAO = 100;

    record Cenario(String leilaoId, int bots, int lancesPorBot, long precoInicial, long incremento) {
        long valorDoLance(int bot, int rodada) {
            long posicao = (long) rodada * bots + bot + 1;
            return precoInicial + posicao * incremento;
        }
    }

    private final HttpClient http = HttpClient.newHttpClient();
    private final JsonMapper json = JsonMapper.builder().build();
    private final Placar placar = new Placar();

    public static void main(String[] args) throws Exception {
        if (args.length < 3) {
            System.out.println("Uso: SimuladorLances <leilaoId> <bots> <lancesPorBot> [incrementoEmCentavos]");
            return;
        }
        SimuladorLances simulador = new SimuladorLances();
        long incremento = args.length > 3 ? Long.parseLong(args[3]) : INCREMENTO_PADRAO;
        Cenario cenario = new Cenario(args[0], Integer.parseInt(args[1]), Integer.parseInt(args[2]),
                simulador.consultarPrecoAtual(args[0]), incremento);
        simulador.executar(cenario);
    }

    private void executar(Cenario cenario) throws Exception {
        long inicio = System.currentTimeMillis();

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int bot = 0; bot < cenario.bots(); bot++) {
                int numeroDoBot = bot;
                executor.submit(() -> rodarBot(cenario, numeroDoBot));
            }
        }

        long duracao = System.currentTimeMillis() - inicio;
        System.out.printf("%d bots x %d lances em %d ms%n", cenario.bots(), cenario.lancesPorBot(), duracao);
        System.out.println(placar.resumo());

        System.out.println("Estado final na leitura: " + buscar(URL_LEITURA + "/leiloes/" + cenario.leilaoId()));
    }

    private void rodarBot(Cenario cenario, int bot) {
        String licitanteId = "bot-" + bot;
        for (int rodada = 0; rodada < cenario.lancesPorBot(); rodada++) {
            long valor = cenario.valorDoLance(bot, rodada);
            placar.registrar(enviarLance(cenario.leilaoId(), licitanteId, valor));
        }
    }

    private int enviarLance(String leilaoId, String licitanteId, long valor) {
        String corpo = "{\"licitanteId\":\"%s\",\"valor\":%d}".formatted(licitanteId, valor);
        HttpRequest pedido = HttpRequest.newBuilder(URI.create(URL_ESCRITA + "/leiloes/" + leilaoId + "/lances"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(corpo))
                .build();
        try {
            return http.send(pedido, HttpResponse.BodyHandlers.discarding()).statusCode();
        } catch (Exception e) {
            return -1;
        }
    }

    private long consultarPrecoAtual(String leilaoId) throws Exception {
        return json.readTree(buscar(URL_LEITURA + "/leiloes/" + leilaoId)).path("precoAtual").asLong();
    }

    private String buscar(String url) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString()).body();
    }
}
