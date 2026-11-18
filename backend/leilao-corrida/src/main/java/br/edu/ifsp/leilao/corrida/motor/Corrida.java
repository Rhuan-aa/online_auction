package br.edu.ifsp.leilao.corrida.motor;

import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Uma corrida: as 6 pistas preparam o mesmo leilão, largam juntas e correm em paralelo, cada uma
 * na própria thread coordenadora e no próprio pool. Termina quando todas terminam (concluídas,
 * paradas ou com erro).
 */
final class Corrida {

    private final UUID id;
    private final Parametros parametros;
    private final List<Pista> pistas = new ArrayList<>();
    private final Runnable aoTerminar;

    private volatile long largadaNanos;
    private volatile long chegadaNanos;
    private volatile boolean rodando = true;
    private volatile Foto resultado;

    Corrida(UUID id, Parametros parametros, long semente, List<Arquitetura> arquiteturas, Runnable aoTerminar) {
        this.id = id;
        this.parametros = parametros;
        this.aoTerminar = aoTerminar;
        Planejador.Plano plano = Planejador.planejar(parametros, semente);
        // Mesmo leilão (mesmo id, preço e incremento) em todas; a rodada separa corridas no CQRS.
        Arquitetura.LeilaoInicial inicial = new Arquitetura.LeilaoInicial(id, UUID.randomUUID(),
                parametros.precoInicial(), parametros.incremento());
        for (Arquitetura a : arquiteturas) {
            pistas.add(new Pista(a, parametros, inicial, plano));
        }
    }

    UUID id() {
        return id;
    }

    boolean rodando() {
        return rodando;
    }

    void iniciar() {
        Thread coordenador = new Thread(this::executar, "corrida-coordenador");
        coordenador.setDaemon(true);
        coordenador.start();
    }

    private void executar() {
        try {
            // 1. Todas preparam (em paralelo); 2. largada comum; 3. todas correm em paralelo.
            List<Thread> preparos = pistas.stream().map(p -> Thread.ofPlatform().name("corrida-preparar-" + p.id())
                    .start(p::preparar)).toList();
            juntar(preparos);
            long largada = System.nanoTime();
            largadaNanos = largada;
            List<Thread> corridas = pistas.stream().map(p -> Thread.ofPlatform().name("corrida-pista-" + p.id())
                    .start(() -> p.correr(largada))).toList();
            juntar(corridas);
        } finally {
            chegadaNanos = System.nanoTime();
            rodando = false;
            resultado = foto();
            aoTerminar.run();
        }
    }

    private static void juntar(List<Thread> threads) {
        for (Thread t : threads) {
            try {
                t.join();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    void parar() {
        pistas.forEach(Pista::parar);
    }

    /** A foto agora; depois do fim, o Resultado (fixo). */
    Foto foto() {
        Foto r = resultado;
        if (r != null) {
            return r;
        }
        long agora = System.nanoTime();
        long fim = chegadaNanos != 0 ? chegadaNanos : agora;
        double decorrido = largadaNanos == 0 ? 0 : Numeros.umaCasa((fim - largadaNanos) / 1e6);
        List<Foto.ArqFoto> arqs = pistas.stream().map(p -> p.foto(agora)).toList();
        return new Foto(id.toString(), parametros, decorrido, rodando, arqs);
    }
}
