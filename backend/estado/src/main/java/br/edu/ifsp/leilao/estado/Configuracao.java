package br.edu.ifsp.leilao.estado;

/**
 * Quais cópias do estado estão ligadas, para comparar o custo de cada camada (ADR-003 e painel de ADM).
 * Escolhida pela propriedade leilao.cache.configuracao (padrão C), igual nos dois serviços.
 *
 * Uma cópia desligada se comporta como vazia: o código segue o mesmo caminho e só cai para a
 * próxima camada. Por isso trocar a configuração não muda nenhuma regra, só o desempenho.
 */
public enum Configuracao {

    /** Sem cópia nenhuma: todo pedido relê todos os eventos do leilão. */
    A,
    /** Só o checkpoint no Postgres: relê no máximo os últimos N eventos. */
    B,
    /** Redis + checkpoint (o normal): na maior parte das vezes, lê 0 ou 1 evento. */
    C;

    boolean usaRedis() {
        return this == C;
    }

    boolean usaCheckpoint() {
        return this != A;
    }
}
