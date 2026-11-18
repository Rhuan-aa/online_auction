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

/**
 * Executa cada comando sempre do mesmo jeito:
 *   obter o estado -> Leilao decide -> anexar os novos eventos -> atualizar as cópias (Redis e checkpoint).
 * Não tem regra de negócio (ela está no Leilao) nem SQL (está no EventStore e no módulo estado).
 *
 * Quem garante que dois lances não vencem juntos é o banco (versaoEsperada + UNIQUE), não o cache:
 * se a decisão foi tomada sobre um estado velho, a gravação é recusada e o comando tenta de novo.
 */
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

    /** Devolve o id do novo leilão. A versão dele é 1 (um evento: LeilaoCriado). */
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

    /** O encerramento define o vencedor: decide sempre sobre o Event Store, nunca sobre cópia (ADR-003). */
    public void encerrar(UUID leilaoId) {
        executar(leilaoId, obterEstado::obterDaFonte, leilao -> leilao.encerrar(Instant.now()));
    }

    /**
     * Obtém o estado pela leitura informada, decide e grava. Se dois comandos disputarem a mesma
     * versão, o perdedor lê de novo PELA MESMA LEITURA e decide outra vez (o lance pode passar a ser
     * recusado por estar abaixo do novo mínimo). Nos comandos é o obter: ele já completa a cópia com
     * os eventos que o vencedor gravou, sem reler o histórico inteiro. Devolve a nova versão e o número
     * de tentativas; uma regra violada sai como LanceRecusadoException com a tentativa em que ocorreu.
     */
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

    /**
     * Grava as cópias do estado depois dos novos eventos: no Redis sempre, no checkpoint a cada
     * N eventos. Roda depois do commit: quando o anexar retorna, a transação dele já terminou.
     * Se uma cópia falhar, só fica um aviso no log; a próxima leitura completa com os eventos.
     */
    private void atualizarCopia(UUID leilaoId, EstadoLeilao anterior, List<EventoLeilao> novos) {
        if (novos.isEmpty()) {
            return;
        }
        EstadoLeilao atual = anterior.aplicarTodos(novos);
        cache.gravar(leilaoId, atual);
        checkpoint.gravarSeNecessario(leilaoId, anterior.versao(), atual);
    }
}
