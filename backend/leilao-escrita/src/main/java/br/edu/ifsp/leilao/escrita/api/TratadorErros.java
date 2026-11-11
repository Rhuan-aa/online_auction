package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.escrita.application.ConflitoDeVersaoException;
import br.edu.ifsp.leilao.escrita.application.LeilaoNaoEncontradoException;
import br.edu.ifsp.leilao.escrita.domain.RegraVioladaException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Converte as exceções em respostas HTTP: {"erro": "...", "mensagem": "..."}. */
@RestControllerAdvice
public class TratadorErros {

    record Erro(String erro, String mensagem) {}

    @ExceptionHandler
    @ResponseStatus(HttpStatus.UNPROCESSABLE_CONTENT) // 422: regra do leilão violada
    public Erro regraViolada(RegraVioladaException e) {
        return new Erro(e.codigo(), e.getMessage());
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.CONFLICT) // 409: conflito persistiu após as retentativas
    public Erro conflito(ConflitoDeVersaoException e) {
        return new Erro("CONFLITO_DE_VERSAO", e.getMessage());
    }

    @ExceptionHandler
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Erro naoEncontrado(LeilaoNaoEncontradoException e) {
        return new Erro("LEILAO_NAO_ENCONTRADO", e.getMessage());
    }
}
