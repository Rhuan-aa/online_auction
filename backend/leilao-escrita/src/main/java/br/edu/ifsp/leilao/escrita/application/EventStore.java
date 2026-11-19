package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import java.util.List;
import java.util.UUID;

public interface EventStore {
    void anexar(UUID leilaoId, int versaoEsperada, List<EventoLeilao> novos);
}
