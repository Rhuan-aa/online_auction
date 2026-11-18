package br.edu.ifsp.leilao.corrida.arquiteturas;

import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import java.util.List;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;

/**
 * Event Sourcing com cópia versionada no Redis (a arquitetura do sistema real, em miniatura).
 * A escrita parte da cópia e aplica só os eventos depois dela; depois de gravar, atualiza a cópia
 * (só se for mais nova). A consulta lê só a cópia; se ela falta, relê os eventos e regrava.
 */
public final class ArquiteturaEsCache extends ArquiteturaEventos {

    public static final String ID = "es-cache";

    private final CopiaRedis cache;

    public ArquiteturaEsCache(JdbcClient jdbc, StringRedisTemplate redis) {
        super(jdbc, ID, "ES + cache", "Eventos imutáveis + cópia versionada no Redis", "corrida_es_cache", List.of());
        this.cache = new CopiaRedis(redis, ID);
    }

    @Override
    public void preparar(LeilaoInicial inicial) {
        cache.apagarTudo();
        super.preparar(inicial);
    }

    @Override
    protected void aposPreparar(EstadoLeilao inicial) {
        cache.gravarSeMaisNova(inicial, Contadores.descartavel());
    }

    @Override
    protected EstadoLeilao carregarParaEscrita(Contadores c) {
        Optional<EstadoLeilao> copia = cache.ler(c);
        return copia.isPresent() ? aplicarEventos(copia.get(), copia.get().versao(), c) : replayCompleto(c);
    }

    @Override
    protected void aposGravar(EstadoLeilao novo, Contadores c) {
        cache.gravarSeMaisNova(novo, c);
    }

    @Override
    public Leitura consultar() {
        Optional<EstadoLeilao> copia = cache.ler(custosLeitura);
        if (copia.isPresent()) {
            return leitura(copia.get());
        }
        EstadoLeilao estado = replayCompleto(custosLeitura);
        cache.gravarSeMaisNova(estado, custosLeitura);
        return leitura(estado);
    }

    @Override
    protected long chavesRedis() {
        return cache.contarChaves();
    }
}
