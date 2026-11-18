package br.edu.ifsp.leilao.ferramentas.reconstrutor;

import br.edu.ifsp.leilao.estado.ReconstrucaoCache;
import br.edu.ifsp.leilao.estado.ReconstrucaoCache.Relatorio;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;

/**
 * Apaga as cópias do estado (Redis e checkpoints) e as refaz só com os eventos do Event Store.
 * Prova do Event Sourcing com cache: as cópias são descartáveis, a verdade são os eventos.
 *
 * Passos:
 *   1. fotografa o estado de cada leilão como as consultas o veem hoje (pelas cópias);
 *   2. apaga o Redis (estados e índice de abertos) e a tabela de checkpoints;
 *   3. refaz cada estado relendo todos os eventos e grava as cópias de novo;
 *   4. compara com a fotografia: devem ser idênticos. Se não forem, a cópia estava atrás da fonte.
 *
 * Pode rodar com os serviços no ar: cópias versionadas nunca ficam erradas, só incompletas.
 * Uso (em backend/):
 *   ./mvnw -q -pl ferramentas -am package -DskipTests
 *   java -jar ferramentas/target/ferramentas-0.1.0-SNAPSHOT.jar
 */
@SpringBootApplication(scanBasePackages = {"br.edu.ifsp.leilao.ferramentas.reconstrutor", "br.edu.ifsp.leilao.estado"})
public class ReconstrutorCache implements CommandLineRunner {

    private final ReconstrucaoCache reconstrucao;

    public ReconstrutorCache(ReconstrucaoCache reconstrucao) {
        this.reconstrucao = reconstrucao;
    }

    public static void main(String[] args) {
        SpringApplication.run(ReconstrutorCache.class, args);
    }

    /**
     * O ObterEstado registra métricas; aqui, sem Actuator, elas só ficam em memória.
     * static: o Spring cria o bean sem precisar criar esta classe antes (ela depende do ObterEstado,
     * que depende deste bean; sem o static, seria uma dependência circular).
     */
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
