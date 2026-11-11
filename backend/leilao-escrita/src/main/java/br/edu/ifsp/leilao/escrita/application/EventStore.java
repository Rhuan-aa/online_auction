package br.edu.ifsp.leilao.escrita.application;

import br.edu.ifsp.leilao.contratos.EventoLeilao;
import java.util.List;
import java.util.UUID;

/**
 * Onde os eventos ficam guardados. A aplicação só conhece esta interface;
 * quem implementa (Postgres) fica em infrastructure.
 */
public interface EventStore {

    /** Todos os eventos do leilão, em ordem de versão. Lista vazia se o leilão não existe. */
    List<EventoLeilao> carregar(UUID leilaoId);

    /**
     * Grava os novos eventos com as versões versaoEsperada+1, versaoEsperada+2...
     * Se outro comando gravou antes (a versão já existe), lança ConflitoDeVersaoException.
     */
    void anexar(UUID leilaoId, int versaoEsperada, List<EventoLeilao> novos);
}
