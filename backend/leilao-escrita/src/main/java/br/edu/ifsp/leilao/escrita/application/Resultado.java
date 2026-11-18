package br.edu.ifsp.leilao.escrita.application;

/** Nova versão do leilão e quantas tentativas o comando precisou (1 = sem disputa). */
public record Resultado(int versao, int tentativas) {}
