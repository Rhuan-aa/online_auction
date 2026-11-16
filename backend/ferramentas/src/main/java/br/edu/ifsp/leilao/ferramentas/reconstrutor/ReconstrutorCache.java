package br.edu.ifsp.leilao.ferramentas.reconstrutor;

import br.edu.ifsp.leilao.estado.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.Checkpoint;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import br.edu.ifsp.leilao.estado.ObterEstado;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
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

    private final LeitorEventos eventos;
    private final ObterEstado obterEstado;
    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;

    public ReconstrutorCache(LeitorEventos eventos, ObterEstado obterEstado, CacheEstadoLeilao cache,
                             Checkpoint checkpoint) {
        this.eventos = eventos;
        this.obterEstado = obterEstado;
        this.cache = cache;
        this.checkpoint = checkpoint;
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
        List<UUID> leiloes = eventos.idsDosLeiloes();
        Map<UUID, EstadoLeilao> antes = obterEstado.obterVariosParaConsulta(leiloes);
        System.out.printf("1. Fotografia: %d leilões, como as consultas os veem hoje.%n", antes.size());

        long chaves = cache.apagarTudo();
        int checkpoints = checkpoint.apagarTodos();
        System.out.printf("2. Apagados: %d chaves no Redis e %d checkpoints.%n", chaves, checkpoints);

        Map<UUID, EstadoLeilao> refeitos = new LinkedHashMap<>();
        for (UUID leilaoId : leiloes) {
            obterEstado.obterDaFonte(leilaoId).ifPresent(estado -> {
                cache.gravar(leilaoId, estado);                         // também recoloca no índice de abertos
                checkpoint.gravarSeNecessario(leilaoId, 0, estado);     // mesma regra de sempre: a partir de N ou se terminou
                refeitos.put(leilaoId, estado);
            });
        }
        cache.repovoarAbertos(refeitos);
        System.out.printf("3. Refeitos %d estados a partir do Event Store.%n", leiloes.size());

        Map<UUID, EstadoLeilao> depois = obterEstado.obterVariosParaConsulta(leiloes);
        List<UUID> diferentes = leiloes.stream()
                .filter(id -> !Objects.equals(antes.get(id), depois.get(id)))
                .toList();
        if (diferentes.isEmpty()) {
            System.out.println("4. Idênticos: as cópias de antes eram iguais ao que os eventos dizem.");
        } else {
            System.out.printf("4. Cópia atrás da fonte (agora corrigida) em %d leilão(ões): %s%n",
                    diferentes.size(), diferentes);
        }
    }
}
