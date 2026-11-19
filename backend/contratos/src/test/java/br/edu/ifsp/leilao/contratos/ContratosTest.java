package br.edu.ifsp.leilao.contratos;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import org.junit.jupiter.api.Test;

class ContratosTest {
    @Test
        void tiposDeEventoSaoUnicosEVersionados() {
        assertEquals(TiposEvento.TODOS.size(), new HashSet<>(TiposEvento.TODOS).size());
        assertTrue(TiposEvento.TODOS.stream().allMatch(t -> t.endsWith(".v1")));
    }

    @Test
    void nomeDoTopico() {
        assertEquals("leilao.eventos", Topicos.EVENTOS_LEILAO);
    }

    @Test
    void cadaTipoTemUmaClasseEIdaEVoltaBatem() {
        TiposEvento.TODOS.forEach(tipo -> assertNotNull(TiposEvento.classeDe(tipo), tipo));
        assertEquals(TiposEvento.LANCE_REGISTRADO, TiposEvento.de(new EventoLeilao.LanceRegistrado("licitante-1", 100)));
    }
}
