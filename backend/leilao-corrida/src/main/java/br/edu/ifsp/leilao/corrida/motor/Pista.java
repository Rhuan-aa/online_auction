package br.edu.ifsp.leilao.corrida.motor;

import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura;
import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura.Leitura;
import br.edu.ifsp.leilao.corrida.arquiteturas.Contadores;
import br.edu.ifsp.leilao.corrida.arquiteturas.ResultadoLance;
import br.edu.ifsp.leilao.corrida.motor.Integridade.LanceAceito;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.LongAdder;

final class Pista {
    private static final long ASSENTAR_MS = 5_000;

    private final Arquitetura arq;
    private final Parametros p;
    private final Arquitetura.LeilaoInicial inicial;
    private final Despachante despachante;

    private final LongAdder enviados = new LongAdder();
    private final LongAdder aceitos = new LongAdder();
    private final LongAdder recusados = new LongAdder();
    private final LongAdder conflitos = new LongAdder();
    private final LongAdder retentativas = new LongAdder();
    private final Histograma escrita = new Histograma();
    private final Histograma leitura = new Histograma();
    private final Curva curva = new Curva();
    private final LeiturasDesatualizadas desatualizadas = new LeiturasDesatualizadas();
    private final ConcurrentLinkedQueue<LanceAceito> aceitosLista = new ConcurrentLinkedQueue<>();
    private final AtomicLong ordemConfirmacao = new AtomicLong();
    private final AtomicLong precoConhecido;
    private final AtomicReference<Leitura> ultimoAceito;
    private volatile Confirmacoes confirmacoes;

    private volatile String status = "rodando";
    private volatile String erro;
    private volatile boolean pararPedido;
    private volatile boolean escritoresTerminaram;
    private volatile long inicioNanos;
    private volatile long fimNanos;
    private volatile Contadores.Foto custosFinais;
    private volatile Foto.Final fim;
    private volatile Leitura estadoFinal;

    Pista(Arquitetura arq, Parametros p, Arquitetura.LeilaoInicial inicial, Planejador.Plano plano) {
        this.arq = arq;
        this.p = p;
        this.inicial = inicial;
        this.despachante = new Despachante(plano);
        this.precoConhecido = new AtomicLong(p.precoInicial());
        this.ultimoAceito = new AtomicReference<>(new Leitura(p.precoInicial(), null, 1));
    }

    String id() {
        return arq.id();
    }

    void parar() {
        pararPedido = true;
    }

    private boolean deveParar() {
        return pararPedido || erro != null;
    }

    private void falhar(Throwable e) {
        synchronized (this) {
            if (erro == null) {
                String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
                erro = msg.length() > 300 ? msg.substring(0, 300) + "…" : msg;
                status = "erro";
            }
        }
    }

    void preparar() {
        try {
            arq.preparar(inicial);
        } catch (Throwable e) {
            falhar(e);
        }
    }

    void correr(long largadaNanos) {
        inicioNanos = largadaNanos;
        if (erro != null) {
            fimNanos = System.nanoTime();
            return;
        }
        ExecutorService pool = null;
        try {
            confirmacoes = new Confirmacoes(p.totalLances() + 1, 1, largadaNanos);

            pool = Executors.newThreadPerTaskExecutor(nomeadas("corrida-" + arq.id()));
            List<Future<?>> escritores = new ArrayList<>();
            for (int i = 0; i < p.simultaneos(); i++) {
                escritores.add(pool.submit(this::escritor));
            }
            List<Future<?>> leitores = new ArrayList<>();
            for (int i = 0; i < p.leitores(); i++) {
                leitores.add(pool.submit(this::leitor));
            }
            esperar(escritores);
            escritoresTerminaram = true;
            fimNanos = System.nanoTime();
            esperar(leitores);
            if (erro == null) {
                status = pararPedido && enviados.sum() < p.totalLances() ? "parada" : "terminou";
            }
        } catch (Throwable e) {
            falhar(e);
        } finally {
            escritoresTerminaram = true;
            if (fimNanos == 0) {
                fimNanos = System.nanoTime();
            }
            if (pool != null) {
                pool.shutdownNow();
            }
            try {
                custosFinais = arq.custos().foto();
            } catch (Throwable e) {
                falhar(e);
            }
            fechar();
        }
    }

    private void escritor() {
        try {
            while (!deveParar()) {
                Despachante.Vez vez = despachante.escolher();
                if (vez == null) {
                    return;
                }
                try {
                    lance(vez.lance());
                } finally {
                    despachante.liberar(vez.licitante());
                }
            }
        } catch (Throwable e) {
            falhar(e);
        }
    }

    private void lance(Planejador.LancePlanejado planejado) {
        String licitante = planejado.licitanteId();
        long valor = Planejador.valorEnviado(planejado, precoConhecido.get());
        long t0 = System.nanoTime();
        ResultadoLance r = arq.darLance(licitante, valor);
        long agora = System.nanoTime();
        double ms = (agora - t0) / 1_000_000.0;

        enviados.increment();
        retentativas.add(r.retentativas());
        switch (r.tipo()) {
            case ACEITO -> {
                aceitos.increment();
                aceitosLista.add(new LanceAceito(licitante, valor, r.versaoBase(), r.versao(),
                        ordemConfirmacao.incrementAndGet()));
                confirmacoes.confirmar(r.versao(), agora);
                precoConhecido.accumulateAndGet(valor, Math::max);
                Leitura nova = new Leitura(valor, licitante, r.versao());
                ultimoAceito.accumulateAndGet(nova, (a, b) -> b.versao() >= a.versao() ? b : a);
            }
            case RECUSADO -> {
                recusados.increment();
                precoConhecido.accumulateAndGet(r.precoAtual(), Math::max);
            }
            case CONFLITO -> {
                conflitos.increment();
                recusados.increment();
                precoConhecido.accumulateAndGet(r.precoAtual(), Math::max);
            }
        }
        escrita.registrar(ms);
        curva.registrar(r.versao(), ms);
    }

    private void leitor() {
        try {
            while (!escritoresTerminaram && !deveParar()) {
                int confirmada = confirmacoes.ultima();
                long t0 = System.nanoTime();
                Leitura lida = arq.consultar();
                double ms = (System.nanoTime() - t0) / 1_000_000.0;
                leitura.registrar(ms);
                desatualizadas.registrar(lida.versao(), confirmada,
                        confirmacoes.atrasoMs(lida.versao(), confirmada, t0));
                precoConhecido.accumulateAndGet(lida.precoAtual(), Math::max);
            }
        } catch (Throwable e) {
            falhar(e);
        }
    }

    private void fechar() {
        try {
            assentar();
            custosFinais = arq.custos().foto();
            Leitura fin = arq.estadoFinal();
            estadoFinal = fin;
            Integridade.Resultado integridade = Integridade.avaliar(aceitosLista, p.precoInicial(), fin.precoAtual(),
                    fin.lider());
            fim = new Foto.Final(integridade, arq.espaco(), arq.auditoria(), fin.precoAtual(), fin.lider());
        } catch (Throwable e) {
            falhar(e);
        }
    }

    private void assentar() {
        int alvo = arq.estadoFinal().versao();
        long limite = System.currentTimeMillis() + ASSENTAR_MS;
        try {
            while (arq.consultar().versao() < alvo && System.currentTimeMillis() < limite) {
                Thread.sleep(20);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    Foto.ArqFoto foto(long agora) {
        long fimOuAgora = fimNanos != 0 ? fimNanos : agora;
        double decorridoS = inicioNanos == 0 ? 0 : Math.max(0, fimOuAgora - inicioNanos) / 1e9;
        long env = enviados.sum();
        Contadores.Foto c = custosFinais != null ? custosFinais : arq.custos().foto();
        LeiturasDesatualizadas.Resumo d = desatualizadas.resumo();
        Leitura atual = estadoFinal != null ? estadoFinal : ultimoAceito.get();
        boolean acabou = !"rodando".equals(status);
        Double terminouEm = acabou && fimNanos != 0 && inicioNanos != 0
                ? Numeros.umaCasa((fimNanos - inicioNanos) / 1e6) : null;
        Foto.Final f = fim;
        return new Foto.ArqFoto(arq.id(), arq.nome(), arq.descricao(), status, erro, terminouEm,
                p.totalLances(), env, aceitos.sum(), recusados.sum(), conflitos.sum(), retentativas.sum(),
                decorridoS > 0 ? Numeros.umaCasa(env / decorridoS) : 0.0,
                new Foto.Escrita(ms(escrita.percentil(50)), ms(escrita.percentil(95)), escrita.amostras()),
                new Foto.Leitura(ms(leitura.percentil(50)), ms(leitura.percentil(95)), d.consultas(), d.desatualizadas(),
                        d.pctDesatualizadas(), d.atrasoMedioVersoes(), d.atrasoMedioMs()),
                curva.pontos(),
                new Foto.Operacoes(c.leiturasBanco(), c.escritasBanco(), c.opsRedis(),
                        env == 0 ? 0.0 : Numeros.umaCasa((double) c.total() / env)),
                atual.precoAtual(),
                atual.lider(),
                atual.versao(),
                f);
    }

    private static double ms(Double v) {
        return v == null ? 0.0 : Numeros.umaCasa(v);
    }

    private static void esperar(List<Future<?>> tarefas) {
        for (Future<?> f : tarefas) {
            try {
                f.get();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            } catch (Exception e) {
            }
        }
    }

    private static ThreadFactory nomeadas(String prefixo) {
        return Thread.ofVirtual().name(prefixo + "-", 1).factory();
    }

    boolean terminou() {
        return fimNanos != 0 && (fim != null || erro != null);
    }
}
