package br.edu.ifsp.leilao.estado;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;
import org.springframework.stereotype.Component;

/**
 * Único caminho para obter o estado de um leilão (ADR-003).
 *
 * Parte da cópia mais recente que houver e aplica só os eventos posteriores à versão dela:
 *   1. cópia no Redis;
 *   2. se não houver, o checkpoint no Postgres; se também não houver, o estado INICIAL (versão 0);
 *   3. eventos do Event Store com versão maior que a da cópia.
 * O Event Store continua sendo a fonte da verdade: a cópia só evita reler o histórico inteiro.
 */
@Component
public class ObterEstado {

    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;
    private final LeitorEventos eventos;

    /** Reconstruções em andamento, por leilão (ver umaReconstrucaoPorVez). */
    private final Map<UUID, CompletableFuture<Optional<EstadoLeilao>>> emAndamento = new ConcurrentHashMap<>();

    public ObterEstado(CacheEstadoLeilao cache, Checkpoint checkpoint, LeitorEventos eventos) {
        this.cache = cache;
        this.checkpoint = checkpoint;
        this.eventos = eventos;
    }

    /** Caminho normal: usa a cópia do Redis se houver. Vazio se o leilão não existe. */
    public Optional<EstadoLeilao> obter(UUID leilaoId) {
        Optional<EstadoLeilao> copia = cache.ler(leilaoId);
        if (copia.isPresent()) {
            return completarEGuardar(leilaoId, copia.get());
        }
        return umaReconstrucaoPorVez(leilaoId, () -> completarEGuardar(leilaoId, checkpointOuInicio(leilaoId)));
    }

    /**
     * Sem cache: relê todos os eventos do Event Store. Usado quando a decisão não pode depender de
     * cópia nenhuma: depois de um conflito de versão e no encerramento (quem venceu).
     */
    public Optional<EstadoLeilao> obterDaFonte(UUID leilaoId) {
        return completar(leilaoId, EstadoLeilao.INICIAL);
    }

    /** Sem cópia no Redis: parte do checkpoint; sem checkpoint, do começo (versão 0). */
    private EstadoLeilao checkpointOuInicio(UUID leilaoId) {
        return checkpoint.ler(leilaoId).orElse(EstadoLeilao.INICIAL);
    }

    /** Aplica sobre a base os eventos que vieram depois dela. */
    private Optional<EstadoLeilao> completar(UUID leilaoId, EstadoLeilao base) {
        EstadoLeilao estado = base.aplicarTodos(eventos.posteriores(leilaoId, base.versao()));
        return estado.existe() ? Optional.of(estado) : Optional.empty();
    }

    /** Cache-aside: se a cópia estava atrás (ou não existia), guarda a versão completa para o próximo. */
    private Optional<EstadoLeilao> completarEGuardar(UUID leilaoId, EstadoLeilao base) {
        Optional<EstadoLeilao> completo = completar(leilaoId, base);
        completo.filter(estado -> estado.versao() > base.versao())
                .ifPresent(estado -> cache.gravar(leilaoId, estado));
        return completo;
    }

    /**
     * Evita que vários pedidos reconstruam o mesmo leilão ao mesmo tempo (cache stampede, ADR-003):
     * o primeiro calcula e os outros esperam o resultado dele, em vez de todos irem ao banco.
     */
    // ponytail: vale só dentro de um processo; com várias instâncias, trocar por um lock no Redis.
    private Optional<EstadoLeilao> umaReconstrucaoPorVez(UUID leilaoId, Supplier<Optional<EstadoLeilao>> reconstruir) {
        CompletableFuture<Optional<EstadoLeilao>> meu = new CompletableFuture<>();
        CompletableFuture<Optional<EstadoLeilao>> deOutro = emAndamento.putIfAbsent(leilaoId, meu);
        if (deOutro != null) {
            return esperar(deOutro);
        }
        try {
            Optional<EstadoLeilao> estado = reconstruir.get();
            meu.complete(estado);
            return estado;
        } catch (RuntimeException e) {
            meu.completeExceptionally(e);
            throw e;
        } finally {
            emAndamento.remove(leilaoId, meu);
        }
    }

    /** Espera a reconstrução de outro pedido; se ela falhou, relança o mesmo erro (sem embrulho). */
    private static Optional<EstadoLeilao> esperar(CompletableFuture<Optional<EstadoLeilao>> reconstrucao) {
        try {
            return reconstrucao.join();
        } catch (CompletionException e) {
            throw e.getCause() instanceof RuntimeException causa ? causa : e;
        }
    }
}
