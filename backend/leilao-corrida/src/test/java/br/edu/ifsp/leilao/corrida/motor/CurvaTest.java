package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.edu.ifsp.leilao.corrida.motor.Curva.Ponto;
import java.util.List;
import org.junit.jupiter.api.Test;

class CurvaTest {
    @Test
    void faixasDe10VersoesRotuladasPeloFim() {
        assertEquals(0, Curva.faixa(1));
        assertEquals(0, Curva.faixa(10));
        assertEquals(1, Curva.faixa(11));
        assertEquals(1, Curva.faixa(20));
        assertEquals(0, Curva.faixa(0), "versão 0 cai na primeira faixa");
    }

    @Test
    void mediaPorFaixaComUmaCasa() {
        Curva c = new Curva();
        c.registrar(2, 3.0);
        c.registrar(10, 4.0);
        c.registrar(11, 5.0);
        c.registrar(20, 6.0);
        c.registrar(20, 6.1);
        assertEquals(List.of(new Ponto(10, 3.5), new Ponto(20, 5.7)), c.pontos());
    }

    @Test
    void pulaFaixasVaziasECresce() {
        Curva c = new Curva();
        c.registrar(5, 1.0);
        c.registrar(1_005, 9.0);
        assertEquals(List.of(new Ponto(10, 1.0), new Ponto(1_010, 9.0)), c.pontos());
    }
}
