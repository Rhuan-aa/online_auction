package br.edu.ifsp.leilao.ferramentas.reconstrutor;

import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache;
import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache.Relatorio;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

@SpringBootApplication(scanBasePackages = {"br.edu.ifsp.leilao.ferramentas.reconstrutor", "br.edu.ifsp.leilao.estado.cache"})
public class ReconstrutorCache implements CommandLineRunner {
    private final ReconstrucaoCache reconstrucao;

    public ReconstrutorCache(ReconstrucaoCache reconstrucao) {
        this.reconstrucao = reconstrucao;
    }

    public static void main(String[] args) {
        SpringApplication.run(ReconstrutorCache.class, args);
    }

    @Bean
    static MeterRegistry metricas() {
        return new SimpleMeterRegistry();
    }

    @Override
    public void run(String... args) {
        Relatorio r = reconstrucao.reconstruir();
        System.out.printf("1. Fotografia: %d leilões, como as consultas os veem hoje.%n", r.leiloes());
        System.out.printf("2. Apagados: %d chaves no Redis e %d checkpoints.%n", r.chavesApagadas(), r.checkpointsApagados());
        System.out.printf("3. Refeitos %d estados a partir do Event Store.%n", r.leiloes());
        if (r.diferentes().isEmpty()) {
            System.out.println("4. Idênticos: as cópias de antes eram iguais ao que os eventos dizem.");
        } else {
            System.out.printf("4. Cópia atrás da fonte (agora corrigida) em %d leilão(ões): %s%n",
                    r.diferentes().size(), r.diferentes());
        }
    }
}
