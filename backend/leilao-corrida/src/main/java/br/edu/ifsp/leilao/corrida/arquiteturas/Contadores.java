package br.edu.ifsp.leilao.corrida.arquiteturas;

import java.util.concurrent.atomic.LongAdder;

/** Operações feitas no banco e no Redis. Seguro entre threads (LongAdder). */
public final class Contadores {

    private final LongAdder leiturasBanco = new LongAdder();
    private final LongAdder escritasBanco = new LongAdder();
    private final LongAdder opsRedis = new LongAdder();

    /** Para operações que não devem entrar na conta (estado final, por exemplo). */
    public static Contadores descartavel() {
        return new Contadores();
    }

    public void leituraBanco() {
        leiturasBanco.increment();
    }

    public void escritaBanco() {
        escritasBanco.increment();
    }

    public void opRedis() {
        opsRedis.increment();
    }

    public void zerar() {
        leiturasBanco.reset();
        escritasBanco.reset();
        opsRedis.reset();
    }

    public Foto foto() {
        return new Foto(leiturasBanco.sum(), escritasBanco.sum(), opsRedis.sum());
    }

    public record Foto(long leiturasBanco, long escritasBanco, long opsRedis) {
        public long total() {
            return leiturasBanco + escritasBanco + opsRedis;
        }
    }
}
