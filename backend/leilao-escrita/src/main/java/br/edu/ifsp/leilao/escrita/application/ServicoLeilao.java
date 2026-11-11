package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.CriarLeilaoRequest;
import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.escrita.domain.Leilao;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import org.springframework.stereotype.Service;

/**
 * Executa cada comando sempre do mesmo jeito:
 *   carregar eventos -> reconstituir o Leilao -> Leilao decide -> anexar os novos eventos.
 * Não tem regra de negócio (ela está no Leilao) nem SQL (está no EventStore).
 */
@Service
public class ServicoLeilao {

    private static final int TENTATIVAS = 3;

    private final EventStore eventStore;

    public ServicoLeilao(EventStore eventStore) {
        this.eventStore = eventStore;
    }

    /** Devolve o id do novo leilão. A versão dele é 1 (um evento: LeilaoCriado). */
    public UUID criar(CriarLeilaoRequest r) {
        List<EventoLeilao> eventos = Leilao.criar(r.vendedorId(), r.titulo(), r.precoInicial(),
                r.incrementoMinimo(), r.inicioEm(), r.fimEm());
        UUID leilaoId = UUID.randomUUID();
        eventStore.anexar(leilaoId, 0, eventos);
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

    /** Estado atual reconstituído dos eventos (usado só pela rota de experimento "sem CQRS"). */
    public Leilao consultar(UUID leilaoId) {
        return carregar(leilaoId);
    }

    /**
     * Se dois comandos disputarem a mesma versão, o perdedor recarrega o leilão e decide de novo
     * (o lance pode passar a ser recusado por estar abaixo do novo mínimo). Devolve a nova versão.
     */
    private int executar(UUID leilaoId, Function<Leilao, List<EventoLeilao>> decisao) {
        for (int tentativa = 1; ; tentativa++) {
            Leilao leilao = carregar(leilaoId);
            List<EventoLeilao> novos = decisao.apply(leilao);
            try {
                eventStore.anexar(leilaoId, leilao.versao(), novos);
                return leilao.versao() + novos.size();
            } catch (ConflitoDeVersaoException conflito) {
                if (tentativa == TENTATIVAS) {
                    throw conflito;
                }
            }
        }
    }

    private Leilao carregar(UUID leilaoId) {
        List<EventoLeilao> eventos = eventStore.carregar(leilaoId);
        if (eventos.isEmpty()) {
            throw new LeilaoNaoEncontradoException(leilaoId);
        }
        return Leilao.reconstituir(eventos);
    }
}
