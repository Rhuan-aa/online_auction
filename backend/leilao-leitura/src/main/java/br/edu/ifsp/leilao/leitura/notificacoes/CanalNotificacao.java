package br.edu.ifsp.leilao.leitura.notificacoes;

/** Como o aviso chega à pessoa. Hoje é log (stub); amanhã pode ser e-mail ou push, sem mudar o Notificador. */
@FunctionalInterface
public interface CanalNotificacao {

    void enviar(String destinatarioId, String mensagem);
}
