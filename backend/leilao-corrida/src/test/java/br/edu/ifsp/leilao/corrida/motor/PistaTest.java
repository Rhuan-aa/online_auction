package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura;
import br.edu.ifsp.leilao.corrida.arquiteturas.Contadores;
import br.edu.ifsp.leilao.corrida.arquiteturas.ResultadoLance;
import br.edu.ifsp.leilao.corrida.regra.EstadoLeilao;
import br.edu.ifsp.leilao.corrida.regra.RegraLance;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** O motor de uma pista, com arquiteturas em memória (sem banco). */
class PistaTest {

    /** Correta: decide e grava sob trava. */
    static class EmMemoria implements Arquitetura {
        final Contadores custos = new Contadores();
        final Contadores custosLeitura = new Contadores();
        EstadoLeilao estado;
        LeilaoInicial leilao;
        final boolean perdeAtualizacoes;
        final RuntimeException falha;

        EmMemoria(boolean perdeAtualizacoes, RuntimeException falha) {
            this.perdeAtualizacoes = perdeAtualizacoes;
            this.falha = falha;
        }

        @Override public String id() { return "mem"; }
        @Override public String nome() { return "Memória"; }
        @Override public String descricao() { return "teste"; }
        @Override public LeilaoInicial leilao() { return leilao; }

        @Override
        public synchronized void preparar(LeilaoInicial inicial) {
            leilao = inicial;
            estado = EstadoLeilao.criado(inicial.precoInicial(), inicial.incremento());
        }

        @Override
        public ResultadoLance darLance(String licitante, long valor) {
            if (falha != null) throw falha;
            EstadoLeilao lido;
            synchronized (this) {
                lido = estado;
                custos.leituraBanco();
            }
            if (!RegraLance.aceita(lido, valor)) {
                return new ResultadoLance(ResultadoLance.Tipo.RECUSADO, lido.versao(), lido.versao(), lido.precoAtual(), 0);
            }
            if (perdeAtualizacoes) {
                Thread.yield(); // abre a janela entre ler e gravar, como o CRUD simples
                try { Thread.sleep(1); } catch (InterruptedException e) { Thread.currentThread().interrupt(); }
            }
            synchronized (this) {
                if (!perdeAtualizacoes && estado.versao() != lido.versao()) {
                    // controle de concorrência: decide de novo sob a trava
                    if (!RegraLance.aceita(estado, valor)) {
                        return new ResultadoLance(ResultadoLance.Tipo.RECUSADO, estado.versao(), estado.versao(),
                                estado.precoAtual(), 1);
                    }
                    lido = estado;
                }
                estado = lido.comLance(licitante, valor);
                custos.escritaBanco();
                return new ResultadoLance(ResultadoLance.Tipo.ACEITO, lido.versao(), estado.versao(), valor, 0);
            }
        }

        @Override
        public synchronized Leitura consultar() {
            custosLeitura.leituraBanco();
            return new Leitura(estado.precoAtual(), estado.lider(), estado.versao());
        }

        @Override public Leitura estadoFinal() { return consultar(); }
        @Override public Contadores custos() { return custos; }
        @Override public Contadores custosLeitura() { return custosLeitura; }
        @Override public Espaco espaco() { return new Espaco(1, 0, 0, 0); }
        @Override public Auditoria auditoria() { return new Auditoria(false, 0); }
    }

    private static Pista correr(EmMemoria arq, Parametros p) {
        Pista pista = new Pista(arq, p, new Arquitetura.LeilaoInicial(UUID.randomUUID(), UUID.randomUUID(),
                p.precoInicial(), p.incremento()), Planejador.planejar(p, 42));
        pista.preparar();
        pista.correr(System.nanoTime());
        return pista;
    }

    @Test
    void arquiteturaCorretaTerminaIntegra() {
        Parametros p = new Parametros(10, 10, 4, 2, 10_000, 100);
        Foto.ArqFoto f = correr(new EmMemoria(false, null), p).foto(System.nanoTime());
        assertEquals("terminou", f.status());
        assertNull(f.erro());
        assertNotNull(f.terminouEmMs());
        assertEquals(100, f.total());
        assertEquals(100, f.enviados());
        assertEquals(f.enviados(), f.aceitos() + f.recusados());
        assertEquals(100, f.escrita().amostras());
        assertTrue(f.aceitos() > 0);
        assertEquals(f.aceitos() + 1, f.versaoAtual());
        assertNotNull(f.fim());
        assertTrue(f.fim().integridade().ok(), f.fim().integridade().detalhe());
        assertEquals(0, f.fim().integridade().lancesPerdidos());
        assertFalse(f.curva().isEmpty());
        assertTrue(f.operacoes().porLance() > 0);
    }

    @Test
    void semControleDeConcorrenciaPerdeLances() {
        Parametros p = new Parametros(8, 8, 8, 0, 10_000, 100);
        Foto.ArqFoto f = correr(new EmMemoria(true, null), p).foto(System.nanoTime());
        assertEquals("terminou", f.status());
        assertTrue(f.fim().integridade().lancesPerdidos() > 0, f.fim().integridade().detalhe());
        assertFalse(f.fim().integridade().ok());
    }

    @Test
    void excecaoMarcaErroSemDerrubar() {
        Parametros p = new Parametros(3, 3, 2, 1, 10_000, 100);
        Foto.ArqFoto f = correr(new EmMemoria(false, new IllegalStateException("banco caiu")), p).foto(System.nanoTime());
        assertEquals("erro", f.status());
        assertEquals("banco caiu", f.erro());
    }
}
