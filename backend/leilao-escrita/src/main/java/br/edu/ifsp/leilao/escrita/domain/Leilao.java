package br.edu.ifsp.leilao.escrita.domain;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import br.edu.ifsp.leilao.estado.EstadoLeilao;
import br.edu.ifsp.leilao.estado.EstadoLeilao.Status;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Agregado Leilao: o ÚNICO lugar onde as regras do leilão existem.
 *
 * Só DECIDE (criar, iniciar, darLance, encerrar, cancelar): valida a regra e DEVOLVE eventos.
 * Não muda nada. O estado chega pronto (EstadoLeilao); quem aplica os eventos é ele.
 *
 * Java puro: sem Spring, sem banco, sem Kafka (garantido pelo ArchitectureTest).
 */
public final class Leilao {

    /** Lance a menos de 30 s do fim prorroga o leilão em 30 s. */
    static final Duration ANTI_SNIPING = Duration.ofSeconds(30);

    private final EstadoLeilao estado;

    private Leilao(EstadoLeilao estado) {
        this.estado = estado;
    }

    /** O leilão no estado dado, de onde quer que ele tenha vindo (eventos, cache ou checkpoint). */
    public static Leilao de(EstadoLeilao estado) {
        return new Leilao(estado);
    }

    // ------------------------------------------------------------------ DECIDIR

    public static List<EventoLeilao> criar(String vendedorId, String titulo, long precoInicial,
                                           long incrementoMinimo, Instant inicioEm, Instant fimEm) {
        boolean invalido = vazio(vendedorId) || vazio(titulo) || precoInicial <= 0 || incrementoMinimo <= 0
                || inicioEm == null || fimEm == null || !fimEm.isAfter(inicioEm);
        if (invalido) {
            throw new RegraVioladaException("LEILAO_INVALIDO",
                    "Informe vendedor e título; preço e incremento positivos; fim depois do início");
        }
        return List.of(new LeilaoCriado(vendedorId, titulo, precoInicial, incrementoMinimo, inicioEm, fimEm));
    }

    /** Chamado pelo agendador. Repetir o comando não gera evento duplicado (idempotente). */
    public List<EventoLeilao> iniciar(Instant agora) {
        if (estado.status() != Status.CRIADO || agora.isBefore(estado.inicioEm())) {
            return List.of();
        }
        return List.of(new LeilaoIniciado(estado.fimEm()));
    }

    public List<EventoLeilao> darLance(String licitanteId, long valor, Instant agora) {
        if (estado.status() != Status.ABERTO || !agora.isBefore(estado.fimEm())) {
            throw new RegraVioladaException("LEILAO_NAO_ABERTO", "O leilão não está aberto para lances");
        }
        if (vazio(licitanteId) || licitanteId.equals(estado.vendedorId())) {
            throw new RegraVioladaException("VENDEDOR_NAO_PODE_DAR_LANCE",
                    "O vendedor não pode dar lance no próprio leilão");
        }
        boolean semLances = estado.liderId() == null;
        long minimo = semLances ? estado.precoAtual() : estado.precoAtual() + estado.incrementoMinimo();
        if (valor < minimo) {
            throw new RegraVioladaException("LANCE_ABAIXO_DO_MINIMO", "Lance mínimo é " + minimo);
        }

        LanceRegistrado lance = new LanceRegistrado(licitanteId, valor);
        boolean faltaPouco = Duration.between(agora, estado.fimEm()).compareTo(ANTI_SNIPING) < 0;
        if (faltaPouco) {
            return List.of(lance, new LeilaoProrrogado(estado.fimEm().plus(ANTI_SNIPING)));
        }
        return List.of(lance);
    }

    /** Chamado pelo agendador. Se o prazo foi prorrogado, ainda não encerra (idempotente). */
    public List<EventoLeilao> encerrar(Instant agora) {
        if (estado.status() != Status.ABERTO || agora.isBefore(estado.fimEm())) {
            return List.of();
        }
        Long valorVencedor = (estado.liderId() == null) ? null : estado.precoAtual();
        return List.of(new LeilaoEncerrado(estado.liderId(), valorVencedor));
    }

    public List<EventoLeilao> cancelar(String motivo) {
        if (estado.terminou()) {
            throw new RegraVioladaException("LEILAO_NAO_ABERTO", "O leilão já terminou");
        }
        if (estado.liderId() != null) {
            throw new RegraVioladaException("LEILAO_COM_LANCES", "Leilão com lances não pode ser cancelado");
        }
        return List.of(new LeilaoCancelado(motivo));
    }

    private static boolean vazio(String texto) {
        return texto == null || texto.isBlank();
    }

    // ------------------------------------------------------------------ LEITURA DO ESTADO

    public EstadoLeilao estado() { return estado; }

    /** Quantos eventos o leilão tem (1, 2, 3...). É a "versão esperada" na próxima gravação. */
    public int versao() { return estado.versao(); }
}