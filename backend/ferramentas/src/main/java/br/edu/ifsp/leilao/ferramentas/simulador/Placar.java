package br.edu.ifsp.leilao.ferramentas.simulador;

import java.util.concurrent.atomic.AtomicInteger;

class Placar {
    private final AtomicInteger aceitos = new AtomicInteger();
    private final AtomicInteger recusados = new AtomicInteger();
    private final AtomicInteger conflitos = new AtomicInteger();
    private final AtomicInteger falhas = new AtomicInteger();

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
