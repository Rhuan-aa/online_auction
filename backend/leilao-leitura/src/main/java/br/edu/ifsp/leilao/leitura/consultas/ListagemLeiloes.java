package br.edu.ifsp.leilao.leitura.consultas;

import br.edu.ifsp.leilao.estado.cache.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.cache.LeitorEventos;
import br.edu.ifsp.leilao.estado.cache.ObterEstado;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class ListagemLeiloes {
    public record LeilaoResumo(UUID leilaoId, String titulo, String status, Long precoAtual, Instant fimEm) {}

    private final ObterEstado obterEstado;
    private final CacheEstadoLeilao cache;
    private final LeitorEventos eventos;

    public ListagemLeiloes(ObterEstado obterEstado, CacheEstadoLeilao cache, LeitorEventos eventos) {
        this.obterEstado = obterEstado;
        this.cache = cache;
        this.eventos = eventos;
    }

    public List<LeilaoResumo> listar(String status) {
        return estados(status).entrySet().stream()
                .filter(item -> status == null || status.equals(item.getValue().status().name()))
                .map(item -> resumo(item.getKey(), item.getValue()))
                .sorted(Comparator.comparing(LeilaoResumo::fimEm))
                .toList();
    }

    private Map<UUID, EstadoLeilao> estados(String status) {
        if (EstadoLeilao.Status.ABERTO.name().equals(status)) {
            Optional<List<UUID>> indice = cache.abertos();
            if (indice.isPresent()) {
                return obterEstado.obterVariosParaConsulta(indice.get());
            }
            Map<UUID, EstadoLeilao> todos = obterEstado.obterVariosParaConsulta(eventos.idsDosLeiloes());
            cache.repovoarAbertos(todos);
            return todos;
        }
        return obterEstado.obterVariosParaConsulta(eventos.idsDosLeiloes());
    }

    private static LeilaoResumo resumo(UUID leilaoId, EstadoLeilao estado) {
        return new LeilaoResumo(leilaoId, estado.titulo(), estado.status().name(), estado.precoAtual(),
                estado.fimEm());
    }
}
