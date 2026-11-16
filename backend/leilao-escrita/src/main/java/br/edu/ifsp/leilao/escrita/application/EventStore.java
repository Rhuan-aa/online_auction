package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import java.util.List;
import java.util.UUID;

/**
 * Onde os eventos são gravados. A aplicação só conhece esta interface;
 * quem implementa (Postgres) fica em infrastructure.
 * A leitura dos eventos fica no LeitorEventos (módulo estado), compartilhado com a leitura.
 */
public interface EventStore {

    /**
     * Grava os novos eventos com as versões versaoEsperada+1, versaoEsperada+2...
     * Se outro comando gravou antes (a versão já existe), lança ConflitoDeVersaoException.
     */
    void anexar(UUID leilaoId, int versaoEsperada, List<EventoLeilao> novos);
}
