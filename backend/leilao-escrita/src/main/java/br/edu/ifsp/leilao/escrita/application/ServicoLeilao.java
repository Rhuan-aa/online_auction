package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.CriarLeilaoRequest;
import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.escrita.domain.Leilao;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.LeitorEventos;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;

/**
 * Executa cada comando sempre do mesmo jeito:
 *   obter o estado -> Leilao decide -> anexar os novos eventos.
 * Não tem regra de negócio (ela está no Leilao) nem SQL (está no EventStore e no LeitorEventos).
 */
@Service
public class ServicoLeilao {

    private static final int TENTATIVAS = 3;

    private final EventStore eventStore;
    private final LeitorEventos eventos;

    public ServicoLeilao(EventStore eventStore, LeitorEventos eventos) {
        this.eventStore = eventStore;
        this.eventos = eventos;
    }

    /** Devolve o id do novo leilão. A versão dele é 1 (um evento: LeilaoCriado). */
    public UUID criar(CriarLeilaoRequest r) {
        List<EventoLeilao> novos = Leilao.criar(r.vendedorId(), r.titulo(), r.precoInicial(),
                r.incrementoMinimo(), r.inicioEm(), r.fimEm());
        UUID leilaoId = UUID.randomUUID();
        eventStore.anexar(leilaoId, 0, novos);
        return leilaoId;
    }

    public int darLance(UUID leilaoId, String licitanteId, long valor) {
        return executar(leilaoId, leilao -> leilao.darLance(licitanteId, valor, Instant.now()));
    }

    public int cancelar(UUID leilaoId, String motivo) {
        return executar(leilaoId, leilao -> leilao.cancelar(motivo));
    }

    public void iniciar(UUID leilaoId) {
        executar(leilaoId, leilao -> leilao.iniciar(Instant.now()));
    }

    public void encerrar(UUID leilaoId) {
        executar(leilaoId, leilao -> leilao.encerrar(Instant.now()));
    }

    /** Estado atual (usado só pela rota de experimento do painel de ADM). */
    public EstadoLeilao consultar(UUID leilaoId) {
        return obterEstado(leilaoId);
    }

    /**
     * Se dois comandos disputarem a mesma versão, o perdedor obtém o estado de novo e decide de novo
     * (o lance pode passar a ser recusado por estar abaixo do novo mínimo). Devolve a nova versão.
     */
    private int executar(UUID leilaoId, Function<Leilao, List<EventoLeilao>> decisao) {
        for (int tentativa = 1; ; tentativa++) {
            EstadoLeilao estado = obterEstado(leilaoId);
            List<EventoLeilao> novos = decisao.apply(Leilao.de(estado));
            try {
                eventStore.anexar(leilaoId, estado.versao(), novos);
                return estado.versao() + novos.size();
            } catch (ConflitoDeVersaoException conflito) {
                if (tentativa == TENTATIVAS) {
                    throw conflito;
                }
            }
        }
    }

    /**
     * Configuração A (sem cópia): parte do estado INICIAL (versão 0) e aplica todos os eventos.
     * Na Etapa 5, o ponto de partida passa a ser a cópia do Redis/checkpoint, e só os eventos
     * posteriores a ela são lidos.
     */
    private EstadoLeilao obterEstado(UUID leilaoId) {
        EstadoLeilao base = EstadoLeilao.INICIAL;
        EstadoLeilao estado = base.aplicarTodos(eventos.posteriores(leilaoId, base.versao()));
        if (!estado.existe()) {
            throw new LeilaoNaoEncontradoException(leilaoId);
        }
        return estado;
    }
}
