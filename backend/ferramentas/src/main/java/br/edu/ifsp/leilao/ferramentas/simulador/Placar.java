package br.edu.ifsp.leilao.ferramentas.simulador;

import java.util.concurrent.atomic.AtomicInteger;

/** Conta as respostas dos lances. AtomicInteger porque todos os bots escrevem ao mesmo tempo. */
class Placar {

    private final AtomicInteger aceitos = new AtomicInteger();   // 200: o lance valeu
    private final AtomicInteger recusados = new AtomicInteger(); // 422: valor abaixo do mínimo
    private final AtomicInteger conflitos = new AtomicInteger(); // 409: perdeu a disputa em todas as tentativas
    private final AtomicInteger falhas = new AtomicInteger();    // qualquer outra resposta

    void registrar(int statusHttp) {
        switch (statusHttp) {
            case 200 -> aceitos.incrementAndGet();
            case 422 -> recusados.incrementAndGet();
            case 409 -> conflitos.incrementAndGet();
            default -> falhas.incrementAndGet();
        }
    }

    String resumo() {
        return "aceitos=%d  recusados(422)=%d  conflitos(409)=%d  falhas=%d"
                .formatted(aceitos.get(), recusados.get(), conflitos.get(), falhas.get());
    }
}
