package br.edu.ifsp.leilao.estado;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.List;
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
 *
 * Métricas (em /actuator/metrics, para o painel de ADM comparar as configurações A/B/C):
 *  - leilao.estado.obter: tempo para obter o estado, por caminho (comando, consulta, fonte);
 *  - leilao.estado.eventos.lidos: quantos eventos foram lidos a cada vez, por base (de onde veio a
 *    cópia: redis, checkpoint, inicio ou fonte). A taxa de acerto do cache é count(base=redis) / total.
 */
@Component
public class ObterEstado {

    /** De onde veio a base sobre a qual os eventos posteriores são aplicados (tag das métricas). */
    private enum Base { REDIS, CHECKPOINT, INICIO, FONTE }

    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;
    private final LeitorEventos eventos;

    private final MeterRegistry metricas;
    private final ConfiguracaoAtiva configuracao;

    /** Reconstruções em andamento, por leilão (ver umaReconstrucaoPorVez). */
    private final Map<UUID, CompletableFuture<Optional<EstadoLeilao>>> emAndamento = new ConcurrentHashMap<>();

    public ObterEstado(CacheEstadoLeilao cache, Checkpoint checkpoint, LeitorEventos eventos, MeterRegistry metricas,
                       ConfiguracaoAtiva configuracao) {
        this.cache = cache;
        this.checkpoint = checkpoint;
        this.eventos = eventos;
        this.metricas = metricas;
        this.configuracao = configuracao;
    }

    /** Medidores levam a tag da configuração em vigor na hora da medição; o registry reaproveita o existente. */
    private Timer tempo(String caminho) {
        return Timer.builder("leilao.estado.obter")
                .description("Tempo para obter o estado de um leilão")
                .tag("caminho", caminho)
                .tag("configuracao", configuracao.atual().name())
                .register(metricas);
    }

    private void registrarEventosLidos(Base base, int quantidade) {
        DistributionSummary.builder("leilao.estado.eventos.lidos")
                .description("Eventos lidos do Event Store para obter o estado")
                .tag("base", base.name().toLowerCase())
                .tag("configuracao", configuracao.atual().name())
                .register(metricas)
                .record(quantidade);
    }

    /**
     * Caminho dos comandos (escrita): usa a cópia do Redis se houver e SEMPRE completa com os
     * eventos posteriores, para decidir sobre o estado mais recente. Vazio se o leilão não existe.
     */
    public Optional<EstadoLeilao> obter(UUID leilaoId) {
        return tempo("comando").record(() -> completarCopia(leilaoId, cache.ler(leilaoId)));
    }

    /**
     * Caminho das consultas (leitura): confia na cópia do Redis, sem ir ao Event Store, se ela
     * tiver pelo menos a versaoMinima pedida. Se não houver cópia ou ela estiver atrás, completa
     * pelo caminho normal (e já deixa a cópia em dia para as próximas consultas).
     * Com versaoMinima = 0, qualquer cópia serve.
     */
    public Optional<EstadoLeilao> obterParaConsulta(UUID leilaoId, int versaoMinima) {
        return tempo("consulta").record(() -> {
            Optional<EstadoLeilao> copia = cache.ler(leilaoId);
            if (copia.isPresent() && copia.get().versao() >= versaoMinima) {
                registrarEventosLidos(Base.REDIS, 0); // confiou na cópia: nenhum evento lido
                return copia;
            }
            return completarCopia(leilaoId, copia);
        });
    }

    /**
     * Para listas: busca as cópias de todos de uma vez no Redis (uma ida só) e confia nelas;
     * os que não têm cópia passam pelo caminho normal, um a um. Leilões inexistentes ficam de fora.
     * O mapa devolvido mantém a ordem da lista recebida.
     */
    public Map<UUID, EstadoLeilao> obterVariosParaConsulta(List<UUID> leiloes) {
        Map<UUID, EstadoLeilao> copias = cache.lerVarios(leiloes);
        Map<UUID, EstadoLeilao> estados = new LinkedHashMap<>();
        for (UUID leilaoId : leiloes) {
            Optional<EstadoLeilao> estado;
            if (copias.containsKey(leilaoId)) {
                registrarEventosLidos(Base.REDIS, 0);
                estado = Optional.of(copias.get(leilaoId));
            } else {
                estado = completarCopia(leilaoId, Optional.empty());
            }
            estado.ifPresent(e -> estados.put(leilaoId, e));
        }
        return estados;
    }

    /** Com cópia: completa a partir dela. Sem cópia: reconstrói (checkpoint ou do início), uma vez só. */
    private Optional<EstadoLeilao> completarCopia(UUID leilaoId, Optional<EstadoLeilao> copia) {
        if (copia.isPresent()) {
            return completarEGuardar(leilaoId, copia.get(), Base.REDIS);
        }
        return umaReconstrucaoPorVez(leilaoId, () -> {
            EstadoLeilao base = checkpointOuInicio(leilaoId);
            return completarEGuardar(leilaoId, base, base.existe() ? Base.CHECKPOINT : Base.INICIO);
        });
    }

    /**
     * Sem cache: relê todos os eventos do Event Store. Usado quando a decisão não pode depender de
     * cópia nenhuma: depois de um conflito de versão e no encerramento (quem venceu).
     */
    public Optional<EstadoLeilao> obterDaFonte(UUID leilaoId) {
        return tempo("fonte").record(() -> completar(leilaoId, EstadoLeilao.INICIAL, Base.FONTE));
    }

    /** Sem cópia no Redis: parte do checkpoint; sem checkpoint, do começo (versão 0). */
    private EstadoLeilao checkpointOuInicio(UUID leilaoId) {
        return checkpoint.ler(leilaoId).orElse(EstadoLeilao.INICIAL);
    }

    /** Aplica sobre a base os eventos que vieram depois dela (e anota quantos foram lidos). */
    private Optional<EstadoLeilao> completar(UUID leilaoId, EstadoLeilao base, Base origem) {
        List<EventoLeilao> posteriores = eventos.posteriores(leilaoId, base.versao());
        registrarEventosLidos(origem, posteriores.size());
        EstadoLeilao estado = base.aplicarTodos(posteriores);
        return estado.existe() ? Optional.of(estado) : Optional.empty();
    }

    /**
     * Cache-aside: guarda a versão completa para o próximo se a cópia do Redis estava atrás ou se
     * não havia cópia no Redis (base do checkpoint). Sem a segunda condição, um leilão encerrado
     * (checkpoint já na versão final) nunca voltaria ao Redis e toda leitura iria ao Postgres.
     */
    private Optional<EstadoLeilao> completarEGuardar(UUID leilaoId, EstadoLeilao base, Base origem) {
        Optional<EstadoLeilao> completo = completar(leilaoId, base, origem);
        completo.filter(estado -> origem != Base.REDIS || estado.versao() > base.versao())
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
