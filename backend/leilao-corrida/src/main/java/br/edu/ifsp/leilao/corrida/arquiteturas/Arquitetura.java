package br.edu.ifsp.leilao.corrida.arquiteturas;

import java.util.UUID;

public interface Arquitetura {
    String id();

    String nome();

    String descricao();

    void preparar(LeilaoInicial inicial);

    ResultadoLance darLance(String licitante, long valor);

    Leitura consultar();

    Leitura estadoFinal();

    Contadores custos();

    Contadores custosLeitura();

    Espaco espaco();

    Auditoria auditoria();

    LeilaoInicial leilao();

    record LeilaoInicial(UUID rodada, UUID leilaoId, long precoInicial, long incremento) {}

    record Leitura(long precoAtual, String lider, int versao) {}

    record Espaco(long linhas, long eventos, long chavesRedis, long bytes) {}

    record Auditoria(boolean suporta, long eventos) {}
}
