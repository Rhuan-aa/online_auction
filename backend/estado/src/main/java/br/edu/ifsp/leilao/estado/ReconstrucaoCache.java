package br.edu.ifsp.leilao.estado;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Apaga as cópias do estado (Redis e checkpoints) e as refaz só com os eventos do Event Store.
 * Usada pela ferramenta CLI e pelo painel de ADM (POST /admin/cache/reconstruir).
 *
 * Passos: fotografa os estados como as consultas os veem; apaga as cópias; refaz cada estado
 * relendo todos os eventos; fotografa de novo e lista os leilões que mudaram.
 * Nas configurações A e B o Redis não é usado, então só se refaz o que a configuração usa.
 */
@Component
public class ReconstrucaoCache {

    public record Tempos(long fotografiaMs, long apagarMs, long refazerMs, long compararMs) {}

    public record Relatorio(int leiloes, long chavesApagadas, int checkpointsApagados, int refeitos,
                            List<UUID> diferentes, Tempos tempos) {}

    private final LeitorEventos eventos;
    private final ObterEstado obterEstado;
    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;

    public ReconstrucaoCache(LeitorEventos eventos, ObterEstado obterEstado, CacheEstadoLeilao cache,
                             Checkpoint checkpoint) {
        this.eventos = eventos;
        this.obterEstado = obterEstado;
        this.cache = cache;
        this.checkpoint = checkpoint;
    }

    public Relatorio reconstruir() {
        long t0 = System.nanoTime();
        List<UUID> leiloes = eventos.idsDosLeiloes();
        Map<UUID, EstadoLeilao> antes = obterEstado.obterVariosParaConsulta(leiloes);
        long t1 = System.nanoTime();

        long chaves = cache.apagarTudo();
        int checkpoints = checkpoint.apagarTodos();
        long t2 = System.nanoTime();

        Map<UUID, EstadoLeilao> refeitos = new LinkedHashMap<>();
        for (UUID leilaoId : leiloes) {
            obterEstado.obterDaFonte(leilaoId).ifPresent(estado -> {
                cache.gravar(leilaoId, estado);                         // também recoloca no índice de abertos
                checkpoint.gravarSeNecessario(leilaoId, 0, estado);     // mesma regra de sempre: a partir de N ou se terminou
                refeitos.put(leilaoId, estado);
            });
        }
        cache.repovoarAbertos(refeitos);
        long t3 = System.nanoTime();

        Map<UUID, EstadoLeilao> depois = obterEstado.obterVariosParaConsulta(leiloes);
        List<UUID> diferentes = leiloes.stream()
                .filter(id -> !Objects.equals(antes.get(id), depois.get(id)))
                .toList();
        long t4 = System.nanoTime();

        return new Relatorio(leiloes.size(), chaves, checkpoints, refeitos.size(), diferentes,
                new Tempos(ms(t0, t1), ms(t1, t2), ms(t2, t3), ms(t3, t4)));
    }

    private static long ms(long de, long ate) {
        return (ate - de) / 1_000_000;
    }
}
