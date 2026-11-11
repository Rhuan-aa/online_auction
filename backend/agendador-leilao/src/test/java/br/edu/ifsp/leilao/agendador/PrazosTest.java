package br.edu.ifsp.leilao.agendador;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.contratos.ComandoAgendador;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Regras do agendador, sem Kafka. O "agora" é passado como parâmetro. */
class PrazosTest {

    static final UUID ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    static final Instant INICIO = Instant.parse("2026-11-16T18:00:00Z");
    static final Instant FIM = Instant.parse("2026-11-16T19:00:00Z");

    final Prazos prazos = new Prazos();

    static List<String> tipos(List<ComandoAgendador> comandos) {
        return comandos.stream().map(ComandoAgendador::tipo).toList();
    }

    @Test
    void antesDoInicioNaoEnviaNada() {
        prazos.registrar(ID, INICIO, FIM);
        assertEquals(List.of(), prazos.vencidos(INICIO.minusSeconds(1)));
    }

    @Test
    void noInicioEnviaIniciarUmaUnicaVez() {
        prazos.registrar(ID, INICIO, FIM);
        assertEquals(List.of(new ComandoAgendador(Prazos.INICIAR, ID, INICIO)), prazos.vencidos(INICIO));
        assertEquals(List.of(), prazos.vencidos(INICIO.plusSeconds(1)));
    }

    @Test
    void depoisDeAbertoEnviaEncerrarNoFim() {
        prazos.registrar(ID, INICIO, FIM);
        prazos.aberto(ID);
        assertEquals(List.of(), prazos.vencidos(FIM.minusSeconds(1)));
        assertEquals(List.of(Prazos.ENCERRAR), tipos(prazos.vencidos(FIM)));
        assertEquals(List.of(), prazos.vencidos(FIM.plusSeconds(1)));
    }

    @Test
    void prorrogacaoAdiaOEncerramento() {
        prazos.registrar(ID, INICIO, FIM);
        prazos.aberto(ID);
        prazos.prorrogado(ID, FIM.plusSeconds(30));
        assertEquals(List.of(), prazos.vencidos(FIM));
        assertEquals(List.of(Prazos.ENCERRAR), tipos(prazos.vencidos(FIM.plusSeconds(30))));
    }

    @Test
    void prorrogacaoDepoisDoEncerrarEnviadoReenviaNoNovoFim() {
        prazos.registrar(ID, INICIO, FIM);
        prazos.aberto(ID);
        prazos.vencidos(FIM);                         // Encerrar enviado no fim antigo...
        prazos.prorrogado(ID, FIM.plusSeconds(30));   // ...mas um lance de última hora prorrogou
        assertEquals(List.of(Prazos.ENCERRAR), tipos(prazos.vencidos(FIM.plusSeconds(30))));
    }

    @Test
    void leilaoTerminadoSaiDaAgenda() {
        prazos.registrar(ID, INICIO, FIM);
        prazos.terminado(ID);
        assertEquals(List.of(), prazos.vencidos(FIM));
    }
}
