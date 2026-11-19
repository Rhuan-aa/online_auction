package br.edu.ifsp.leilao.estado.cache;

import br.edu.ifsp.leilao.estado.EstadoLeilao;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import br.edu.ifsp.leilao.contratos.EventoLeilao.LeilaoEncerrado;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;

class CheckpointTest {
    static EstadoLeilao abertoNaVersao(int versao) {
        List<EventoLeilao> eventos = new ArrayList<>(EventosDeTeste.EVENTOS.subList(0, 2));
        while (eventos.size() < versao) {
            eventos.add(new EventoLeilao.LanceRegistrado("licitante-1", 10_000L + eventos.size()));
        }
        return EstadoLeilao.INICIAL.aplicarTodos(eventos);
    }

    @Test
    void trocarParaALeDevolveVazioSemTocarNoBanco() {
        JdbcClient quebrado = (JdbcClient) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {JdbcClient.class}, (proxy, metodo, args) -> {
                    throw new AssertionError("não devia tocar no banco");
                });
        var configuracao = new ConfiguracaoAtiva(Configuracao.C);
        var checkpoint = new Checkpoint(quebrado, null, 50, configuracao);

        configuracao.trocar(Configuracao.A);

        assertEquals(Optional.empty(), checkpoint.ler(UUID.randomUUID()));
        checkpoint.gravarSeNecessario(UUID.randomUUID(), 0, abertoNaVersao(50));
    }

    @Test
    void gravaQuandoPassaDeUmMultiploDeN() {
        assertTrue(Checkpoint.deveGravar(49, abertoNaVersao(50), 50));
        assertTrue(Checkpoint.deveGravar(49, abertoNaVersao(51), 50));
        assertTrue(Checkpoint.deveGravar(99, abertoNaVersao(100), 50));
    }

    @Test
    void naoGravaEntreUmMultiploEOutro() {
        assertFalse(Checkpoint.deveGravar(50, abertoNaVersao(51), 50));
        assertFalse(Checkpoint.deveGravar(3, abertoNaVersao(4), 50));
    }

    @Test
    void gravaSempreQueOLeilaoTermina() {
        EstadoLeilao encerrado = abertoNaVersao(6).aplicar(new LeilaoEncerrado("licitante-1", 10_005L));
        assertTrue(Checkpoint.deveGravar(6, encerrado, 50));
    }
}
