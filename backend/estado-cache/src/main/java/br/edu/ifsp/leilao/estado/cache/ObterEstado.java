package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
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

@Component
public class ObterEstado {
    private enum Base { REDIS, CHECKPOINT, INICIO, FONTE }

    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;
    private final LeitorEventos eventos;

    private final MeterRegistry metricas;
    private final ConfiguracaoAtiva configuracao;

    private final Map<UUID, CompletableFuture<Optional<EstadoLeilao>>> emAndamento = new ConcurrentHashMap<>();

    public ObterEstado(CacheEstadoLeilao cache, Checkpoint checkpoint, LeitorEventos eventos, MeterRegistry metricas,
                       ConfiguracaoAtiva configuracao) {
        this.cache = cache;
        this.checkpoint = checkpoint;
        this.eventos = eventos;
        this.metricas = metricas;
        this.configuracao = configuracao;
    }

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

    public Optional<EstadoLeilao> obter(UUID leilaoId) {
        return tempo("comando").record(() -> completarCopia(leilaoId, cache.ler(leilaoId)));
    }

    public Optional<EstadoLeilao> obterParaConsulta(UUID leilaoId, int versaoMinima) {
        return tempo("consulta").record(() -> {
            Optional<EstadoLeilao> copia = cache.ler(leilaoId);
            if (copia.isPresent() && copia.get().versao() >= versaoMinima) {
                registrarEventosLidos(Base.REDIS, 0);
                return copia;
            }
            return completarCopia(leilaoId, copia);
        });
    }

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

    private Optional<EstadoLeilao> completarCopia(UUID leilaoId, Optional<EstadoLeilao> copia) {
        if (copia.isPresent()) {
            return completarEGuardar(leilaoId, copia.get(), Base.REDIS);
        }
        return umaReconstrucaoPorVez(leilaoId, () -> {
            EstadoLeilao base = checkpointOuInicio(leilaoId);
            return completarEGuardar(leilaoId, base, base.existe() ? Base.CHECKPOINT : Base.INICIO);
        });
    }

    public Optional<EstadoLeilao> obterDaFonte(UUID leilaoId) {
        return tempo("fonte").record(() -> completar(leilaoId, EstadoLeilao.INICIAL, Base.FONTE));
    }

    private EstadoLeilao checkpointOuInicio(UUID leilaoId) {
        return checkpoint.ler(leilaoId).orElse(EstadoLeilao.INICIAL);
    }

    private Optional<EstadoLeilao> completar(UUID leilaoId, EstadoLeilao base, Base origem) {
        List<EventoLeilao> posteriores = eventos.posteriores(leilaoId, base.versao());
        registrarEventosLidos(origem, posteriores.size());
        EstadoLeilao estado = base.aplicarTodos(posteriores);
        return estado.existe() ? Optional.of(estado) : Optional.empty();
    }

    private Optional<EstadoLeilao> completarEGuardar(UUID leilaoId, EstadoLeilao base, Base origem) {
        Optional<EstadoLeilao> completo = completar(leilaoId, base, origem);
        completo.filter(estado -> origem != Base.REDIS || estado.versao() > base.versao())
                .ifPresent(estado -> cache.gravar(leilaoId, estado));
        return completo;
    }

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

    private static Optional<EstadoLeilao> esperar(CompletableFuture<Optional<EstadoLeilao>> reconstrucao) {
        try {
            return reconstrucao.join();
        } catch (CompletionException e) {
            throw e.getCause() instanceof RuntimeException causa ? causa : e;
        }
    }
}
