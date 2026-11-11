package br.edu.ifsp.leilao.escrita.domain;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LanceRegistrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCancelado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoCriado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoIniciado;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoProrrogado;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Agregado Leilao: o ÚNICO lugar onde as regras do leilão existem.
 *
 * Dois tipos de método:
 *  - DECIDIR (criar, iniciar, darLance, encerrar, cancelar): valida a regra e DEVOLVE eventos. Não muda nada.
 *  - APLICAR (aplicar): muda o estado a partir de um evento. Não valida nada.
 *
 * O estado nunca é salvo: é reconstituído aplicando os eventos em ordem (Event Sourcing).
 * Java puro: sem Spring, sem banco, sem Kafka (garantido pelo ArchitectureTest).
 */
public final class Leilao {

    /** Lance a menos de 30 s do fim prorroga o leilão em 30 s. */
    static final Duration ANTI_SNIPING = Duration.ofSeconds(30);

    public enum Status { CRIADO, ABERTO, ENCERRADO, CANCELADO }

    private Status status;
    private String vendedorId;
    private String titulo;
    private long precoAtual;
    private long incrementoMinimo;
    private String liderId;
    private Instant inicioEm;
    private Instant fimEm;
    private int versao;

    private Leilao() {}

    /** Reconstrói o leilão aplicando todos os eventos já gravados, em ordem de versão. */
    public static Leilao reconstituir(List<EventoLeilao> eventos) {
        Leilao leilao = new Leilao();
        eventos.forEach(leilao::aplicar);
        return leilao;
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
        if (status != Status.CRIADO || agora.isBefore(inicioEm)) {
            return List.of();
        }
        return List.of(new LeilaoIniciado(fimEm));
    }

    public List<EventoLeilao> darLance(String licitanteId, long valor, Instant agora) {
        if (status != Status.ABERTO || !agora.isBefore(fimEm)) {
            throw new RegraVioladaException("LEILAO_NAO_ABERTO", "O leilão não está aberto para lances");
        }
        if (vazio(licitanteId) || licitanteId.equals(vendedorId)) {
            throw new RegraVioladaException("VENDEDOR_NAO_PODE_DAR_LANCE", "O vendedor não pode dar lance no próprio leilão");
        }
        long minimo = (liderId == null) ? precoAtual : precoAtual + incrementoMinimo;
        if (valor < minimo) {
            throw new RegraVioladaException("LANCE_ABAIXO_DO_MINIMO", "Lance mínimo é " + minimo);
        }

        LanceRegistrado lance = new LanceRegistrado(licitanteId, valor);
        boolean faltaPouco = Duration.between(agora, fimEm).compareTo(ANTI_SNIPING) < 0;
        if (faltaPouco) {
            return List.of(lance, new LeilaoProrrogado(fimEm.plus(ANTI_SNIPING)));
        }
        return List.of(lance);
    }

    /** Chamado pelo agendador. Se o prazo foi prorrogado, ainda não encerra (idempotente). */
    public List<EventoLeilao> encerrar(Instant agora) {
        if (status != Status.ABERTO || agora.isBefore(fimEm)) {
            return List.of();
        }
        Long valorVencedor = (liderId == null) ? null : precoAtual;
        return List.of(new LeilaoEncerrado(liderId, valorVencedor));
    }

    public List<EventoLeilao> cancelar(String motivo) {
        if (status == Status.ENCERRADO || status == Status.CANCELADO) {
            throw new RegraVioladaException("LEILAO_NAO_ABERTO", "O leilão já terminou");
        }
        if (liderId != null) {
            throw new RegraVioladaException("LEILAO_COM_LANCES", "Leilão com lances não pode ser cancelado");
        }
        return List.of(new LeilaoCancelado(motivo));
    }

    // ------------------------------------------------------------------ APLICAR

    private void aplicar(EventoLeilao evento) {
        versao++;
        switch (evento) {
            case LeilaoCriado e -> {
                status = Status.CRIADO;
                vendedorId = e.vendedorId();
                titulo = e.titulo();
                precoAtual = e.precoInicial();
                incrementoMinimo = e.incrementoMinimo();
                inicioEm = e.inicioEm();
                fimEm = e.fimEm();
            }
            case LeilaoIniciado e -> status = Status.ABERTO;
            case LanceRegistrado e -> {
                precoAtual = e.valor();
                liderId = e.licitanteId();
            }
            case LeilaoProrrogado e -> fimEm = e.novoFimEm();
            case LeilaoEncerrado e -> status = Status.ENCERRADO;
            case LeilaoCancelado e -> status = Status.CANCELADO;
        }
    }

    private static boolean vazio(String texto) {
        return texto == null || texto.isBlank();
    }

    // ------------------------------------------------------------------ LEITURA DO ESTADO

    /** Quantos eventos o leilão tem (1, 2, 3...). É a "versão esperada" na próxima gravação. */
    public int versao() { return versao; }
    public Status status() { return status; }
    public String titulo() { return titulo; }
    public long precoAtual() { return precoAtual; }
    public String liderId() { return liderId; }
    public Instant fimEm() { return fimEm; }
}
