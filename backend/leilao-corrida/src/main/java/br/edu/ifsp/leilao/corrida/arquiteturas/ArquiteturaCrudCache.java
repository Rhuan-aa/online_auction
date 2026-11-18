package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import br.edu.ifsp.leilao.corrida.regra.RegraLance;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * CRUD com controle otimista e cache. A escrita lê a linha no banco, decide e grava com
 * {@code UPDATE ... WHERE versao = ?}; se outra thread gravou antes (0 linhas), tenta de novo
 * (até {@link ResultadoLance#MAX_TENTATIVAS}). Depois de gravar, atualiza a cópia no Redis (só se
 * for mais nova). A consulta lê o Redis (cache-aside): se a chave falta, lê o banco e preenche.
 */
public final class ArquiteturaCrudCache extends ArquiteturaLinha {

    public static final String ID = "crud-cache";

    private final CopiaRedis cache;

    public ArquiteturaCrudCache(JdbcClient jdbc, StringRedisTemplate redis) {
        super(jdbc, ID, "CRUD + cache", "UPDATE otimista por versão + cópia no Redis (cache-aside)",
                "corrida_crud_cache");
        this.cache = new CopiaRedis(redis, ID);
    }

    @Override
    public void preparar(LeilaoInicial inicial) {
        cache.apagarTudo();
        criarLinha(inicial);
        zerarContadores();
    }

    @Override
    public ResultadoLance darLance(String licitante, long valor) {
        EstadoLeilao atual = null;
        for (int tentativa = 1; tentativa <= ResultadoLance.MAX_TENTATIVAS; tentativa++) {
            atual = lerLinha(custos);
            if (!RegraLance.aceita(atual, valor)) {
                return new ResultadoLance(ResultadoLance.Tipo.RECUSADO, atual.versao(), atual.versao(),
                        atual.precoAtual(), tentativa - 1);
            }
            EstadoLeilao novo = atual.comLance(licitante, valor);
            custos.escritaBanco();
            int linhas = jdbc.sql("UPDATE " + tabela
                            + " SET preco_atual = ?, lider = ?, versao = ? WHERE id = ? AND versao = ?")
                    .params(novo.precoAtual(), novo.lider(), novo.versao(), leilao.leilaoId(), atual.versao())
                    .update();
            if (linhas == 1) {
                cache.gravarSeMaisNova(novo, custos);
                return new ResultadoLance(ResultadoLance.Tipo.ACEITO, atual.versao(), novo.versao(), valor, tentativa - 1);
            }
        }
        return new ResultadoLance(ResultadoLance.Tipo.CONFLITO, atual.versao(), atual.versao(), atual.precoAtual(),
                ResultadoLance.MAX_TENTATIVAS - 1);
    }

    @Override
    public Leitura consultar() {
        Optional<EstadoLeilao> copia = cache.ler(custosLeitura);
        if (copia.isPresent()) {
            return leitura(copia.get());
        }
        EstadoLeilao doBanco = lerLinha(custosLeitura);
        cache.gravarSeMaisNova(doBanco, custosLeitura);
        return leitura(doBanco);
    }

    @Override
    public Espaco espaco() {
        return new Espaco(contarLinhas(tabela), 0, cache.contarChaves(), bytes());
    }
}
