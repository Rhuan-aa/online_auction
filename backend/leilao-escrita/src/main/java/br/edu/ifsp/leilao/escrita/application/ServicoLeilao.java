package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.CriarLeilaoRequest;
import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.escrita.domain.Leilao;
import br.edu.ifsp.leilao.escrita.domain.RegraVioladaException;
import br.edu.ifsp.leilao.estado.CacheEstadoLeilao;
import br.edu.ifsp.leilao.estado.Checkpoint;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.ObterEstado;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;

@Service
public class ServicoLeilao {
    private static final int TENTATIVAS = 3;

    private final EventStore eventStore;
    private final ObterEstado obterEstado;
    private final CacheEstadoLeilao cache;
    private final Checkpoint checkpoint;

    public ServicoLeilao(EventStore eventStore, ObterEstado obterEstado, CacheEstadoLeilao cache,
                         Checkpoint checkpoint) {
        this.eventStore = eventStore;
        this.obterEstado = obterEstado;
        this.cache = cache;
        this.checkpoint = checkpoint;
    }

    public UUID criar(CriarLeilaoRequest r) {
        List<EventoLeilao> novos = Leilao.criar(r.vendedorId(), r.titulo(), r.precoInicial(),
                r.incrementoMinimo(), r.inicioEm(), r.fimEm());
        UUID leilaoId = UUID.randomUUID();
        eventStore.anexar(leilaoId, 0, novos);
        atualizarCopia(leilaoId, EstadoLeilao.INICIAL, novos);
        return leilaoId;
    }

    public Resultado darLance(UUID leilaoId, String licitanteId, long valor) {
        return executar(leilaoId, obterEstado::obter, leilao -> leilao.darLance(licitanteId, valor, Instant.now()));
    }

    public Resultado cancelar(UUID leilaoId, String motivo) {
        return executar(leilaoId, obterEstado::obter, leilao -> leilao.cancelar(motivo));
    }

    public void iniciar(UUID leilaoId) {
        executar(leilaoId, obterEstado::obter, leilao -> leilao.iniciar(Instant.now()));
    }

    public void encerrar(UUID leilaoId) {
        executar(leilaoId, obterEstado::obterDaFonte, leilao -> leilao.encerrar(Instant.now()));
    }

    private Resultado executar(UUID leilaoId, Function<UUID, Optional<EstadoLeilao>> leitura,
                         Function<Leilao, List<EventoLeilao>> decisao) {
        for (int tentativa = 1; ; tentativa++) {
            EstadoLeilao estado = leitura.apply(leilaoId)
                    .orElseThrow(() -> new LeilaoNaoEncontradoException(leilaoId));
            List<EventoLeilao> novos;
            try {
                novos = decisao.apply(Leilao.de(estado));
            } catch (RegraVioladaException recusa) {
                throw new LanceRecusadoException(recusa, tentativa);
            }
            try {
                eventStore.anexar(leilaoId, estado.versao(), novos);
            } catch (ConflitoDeVersaoException conflito) {
                if (tentativa == TENTATIVAS) {
                    throw new ConflitoDeVersaoException(conflito, tentativa);
                }
                continue;
            }
            atualizarCopia(leilaoId, estado, novos);
            return new Resultado(estado.versao() + novos.size(), tentativa);
        }
    }

    private void atualizarCopia(UUID leilaoId, EstadoLeilao anterior, List<EventoLeilao> novos) {
        if (novos.isEmpty()) {
            return;
        }
        EstadoLeilao atual = anterior.aplicarTodos(novos);
        cache.gravar(leilaoId, atual);
        checkpoint.gravarSeNecessario(leilaoId, anterior.versao(), atual);
    }
}
