package br.edu.ifsp.leilao.corrida.motor;

import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura.Auditoria;
import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura.Espaco;
import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.util.List;

/**
 * Foto da corrida (evento SSE {@code foto}) e, com {@code rodando:false} e os campos de
 * {@link Final} em cada arquitetura, o Resultado (evento {@code fim}). Nomes iguais ao contrato
 * docs/superpowers/specs/2026-11-19-corrida-contrato.md.
 */
public record Foto(String corridaId, Parametros parametros, double decorridoMs, boolean rodando,
                   List<ArqFoto> arquiteturas) {

    public record ArqFoto(String id, String nome, String descricao, String status, String erro, Double terminouEmMs,
                          int total, long enviados, long aceitos, long recusados, long conflitos, long retentativas,
                          double lancesPorSegundo, Escrita escrita, Leitura leitura, List<Curva.Ponto> curva,
                          Operacoes operacoes, long precoAtual, String liderAtual, int versaoAtual,
                          /* Só no Resultado; null na foto (e aí nenhum desses campos aparece). */
                          @JsonUnwrapped Final fim) {}

    public record Escrita(double p50, double p95, long amostras) {}

    public record Leitura(double p50, double p95, long consultas, long desatualizadas, double pctDesatualizadas,
                          double atrasoMedioVersoes, double atrasoMedioMs) {}

    public record Operacoes(long leiturasBanco, long escritasBanco, long opsRedis, double porLance) {}

    public record Final(Integridade.Resultado integridade, Espaco espaco, Auditoria auditoria, long precoFinal,
                        String vencedor) {}
}
