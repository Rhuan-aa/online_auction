package br.edu.ifsp.leilao.ferramentas.simulador;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.concurrent.Executors;
import tools.jackson.databind.json.JsonMapper;

/**
 * Teste de concorrência: N bots dão lances ao mesmo tempo no mesmo leilão.
 *
 * Uso: SimuladorLances <leilaoId> <bots> <lancesPorBot> [incrementoEmCentavos]
 *
 * Cada bot roda em uma virtual thread (barata: 50 ou 5000 bots não pesam).
 * Os lances disputam a mesma versão do leilão; o event store garante que só um vence cada
 * disputa (UNIQUE aggregate_id + version) e o ServicoLeilao reavalia os perdedores.
 * No fim, o resultado é conferido no serviço de leitura: o líder é um só.
 */
public class SimuladorLances {

    private static final String URL_ESCRITA = System.getenv().getOrDefault("URL_ESCRITA", "http://localhost:8081");
    private static final String URL_LEITURA = System.getenv().getOrDefault("URL_LEITURA", "http://localhost:8082");
    private static final long INCREMENTO_PADRAO = 100;
    private static final long ESPERA_DA_PROJECAO_MS = 1500;

    /** Tudo que define uma simulação. O valor de cada lance sai daqui. */
    record Cenario(String leilaoId, int bots, int lancesPorBot, long precoInicial, long incremento) {

        /**
         * Cada lance tem valor próprio e crescente. Ex.: bot 3, rodada 2, com 50 bots:
         * precoInicial + (2 * 50 + 3 + 1) * incremento. Como nenhum valor se repete,
         * se o sistema funciona o maior valor é o único vencedor.
         */
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
        } // ao sair do try, espera todos os bots terminarem

        long duracao = System.currentTimeMillis() - inicio;
        System.out.printf("%d bots x %d lances em %d ms%n", cenario.bots(), cenario.lancesPorBot(), duracao);
        System.out.println(placar.resumo());

        Thread.sleep(ESPERA_DA_PROJECAO_MS); // dá tempo da projeção alcançar o último evento
        System.out.println("Estado final na leitura: " + buscar(URL_LEITURA + "/leiloes/" + cenario.leilaoId()));
    }

    private void rodarBot(Cenario cenario, int bot) {
        String licitanteId = "bot-" + bot;
        for (int rodada = 0; rodada < cenario.lancesPorBot(); rodada++) {
            long valor = cenario.valorDoLance(bot, rodada);
            placar.registrar(enviarLance(cenario.leilaoId(), licitanteId, valor));
        }
    }

    /** Devolve o status HTTP, ou -1 se nem chegou a conversar com o servidor. */
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

    /** Lê o preço na leitura para os bots começarem acima dele. */
    private long consultarPrecoAtual(String leilaoId) throws Exception {
        return json.readTree(buscar(URL_LEITURA + "/leiloes/" + leilaoId)).path("precoAtual").asLong();
    }

    private String buscar(String url) throws Exception {
        return http.send(HttpRequest.newBuilder(URI.create(url)).build(), HttpResponse.BodyHandlers.ofString()).body();
    }
}
