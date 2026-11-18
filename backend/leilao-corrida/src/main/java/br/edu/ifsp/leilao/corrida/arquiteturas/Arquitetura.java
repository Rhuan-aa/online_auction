package br.edu.ifsp.leilao.corrida.arquiteturas;

import java.util.UUID;

/**
 * Uma forma de guardar o leilão. As 6 implementações recebem os mesmos lances e usam a mesma
 * regra ({@link br.edu.ifsp.leilao.corrida.regra.RegraLance}); muda só onde e como o estado fica.
 * Todas são seguras para várias threads ao mesmo tempo (o CRUD simples é "seguro" só no sentido
 * de não quebrar: ele perde lances de propósito).
 */
public interface Arquitetura {

    String id();

    String nome();

    String descricao();

    /** Apaga só os próprios dados (tabelas e chaves) e cria o leilão inicial. Zera os contadores. */
    void preparar(LeilaoInicial inicial);

    /** Decide e grava um lance. Conta as operações em {@link #custos()}. */
    ResultadoLance darLance(String licitante, long valor);

    /** Consulta como a tela consultaria (pode estar atrasada, no CQRS). Conta em {@link #custosLeitura()}. */
    Leitura consultar();

    /** Estado verdadeiro ao final (fonte da verdade da arquitetura), sem contar operações. */
    Leitura estadoFinal();

    /** Operações do caminho de escrita (lances e, no CQRS, a projeção). */
    Contadores custos();

    /** Operações das consultas. */
    Contadores custosLeitura();

    Espaco espaco();

    Auditoria auditoria();

    /** Dados da preparação em vigor (null antes da primeira). */
    LeilaoInicial leilao();

    record LeilaoInicial(UUID rodada, UUID leilaoId, long precoInicial, long incremento) {}

    record Leitura(long precoAtual, String lider, int versao) {}

    record Espaco(long linhas, long eventos, long chavesRedis, long bytes) {}

    record Auditoria(boolean suporta, long eventos) {}
}
