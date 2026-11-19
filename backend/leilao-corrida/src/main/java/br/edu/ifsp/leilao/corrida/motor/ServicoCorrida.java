package br.edu.ifsp.leilao.corrida.motor;

import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class ServicoCorrida implements MotorCorrida, DisposableBean {
    static final long INTERVALO_MS = 250;

    private final List<Arquitetura> arquiteturas;
    private final ScheduledExecutorService relogio;
    private final List<SseEmitter> assinantes = new CopyOnWriteArrayList<>();

    private final Object trava = new Object();

    private volatile Corrida atual;
    private volatile boolean fimEnviado;

    public ServicoCorrida(List<Arquitetura> arquiteturas) {
        this.arquiteturas = arquiteturas;
        this.relogio = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "corrida-sse");
            t.setDaemon(true);
            return t;
        });
        relogio.scheduleAtFixedRate(this::transmitirFoto, INTERVALO_MS, INTERVALO_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    public UUID iniciar(ValidadorParametros.Pedido pedido) {
        Corrida rodando = atual;
        if (rodando != null && rodando.rodando()) {
            throw new CorridaEmAndamentoException(rodando.id());
        }

        Corrida[] ref = new Corrida[1];
        Corrida nova = new Corrida(UUID.randomUUID(), pedido.parametros(), pedido.semente(), arquiteturas,
                () -> transmitirFim(ref[0]));
        ref[0] = nova;
        synchronized (trava) {
            Corrida c = atual;
            if (c != null && c.rodando()) {
                throw new CorridaEmAndamentoException(c.id());
            }

            assinantes.forEach(SseEmitter::complete);
            assinantes.clear();
            fimEnviado = false;
            atual = nova;
            nova.iniciar();
            return nova.id();
        }
    }

    private Optional<Corrida> corrida(UUID id) {
        Corrida c = atual;
        return c != null && c.id().equals(id) ? Optional.of(c) : Optional.empty();
    }

    @Override
    public boolean parar(UUID id) {
        Optional<Corrida> c = corrida(id);
        c.ifPresent(Corrida::parar);
        return c.isPresent();
    }

    @Override
    public Optional<Foto> foto(UUID id) {
        return corrida(id).map(Corrida::foto);
    }

    @Override
    public Optional<SseEmitter> assinar(UUID id) {
        Optional<Corrida> c = corrida(id);
        if (c.isEmpty()) {
            return Optional.empty();
        }
        SseEmitter emissor = new SseEmitter(0L);
        emissor.onCompletion(() -> assinantes.remove(emissor));
        emissor.onTimeout(() -> assinantes.remove(emissor));
        emissor.onError(e -> assinantes.remove(emissor));
        synchronized (trava) {
            Corrida corrida = c.get();
            if (atual != corrida || fimEnviado) {
                enviar(emissor, "fim", corrida.foto());
                emissor.complete();
            } else {
                assinantes.add(emissor);
                enviar(emissor, "foto", corrida.foto());
            }
        }
        return Optional.of(emissor);
    }

    private void transmitirFoto() {
        try {
            synchronized (trava) {
                Corrida c = atual;
                if (c == null || fimEnviado || assinantes.isEmpty() || !c.rodando()) {
                    return;
                }
                Foto foto = c.foto();
                assinantes.forEach(e -> enviar(e, "foto", foto));
            }
        } catch (RuntimeException e) {
        }
    }

    private void transmitirFim(Corrida c) {
        synchronized (trava) {
            if (c == null || atual != c || fimEnviado) {
                return;
            }
            fimEnviado = true;
            Foto resultado = c.foto();
            for (SseEmitter e : assinantes) {
                enviar(e, "fim", resultado);
                e.complete();
            }
            assinantes.clear();
        }
    }

    private void enviar(SseEmitter emissor, String evento, Foto dados) {
        try {
            emissor.send(SseEmitter.event().name(evento).data(dados));
        } catch (IOException | IllegalStateException e) {
            assinantes.remove(emissor);
            emissor.completeWithError(e);
        }
    }

    @Override
    public void destroy() {
        Corrida c = atual;
        if (c != null) {
            c.parar();
        }
        relogio.shutdownNow();
    }
}
