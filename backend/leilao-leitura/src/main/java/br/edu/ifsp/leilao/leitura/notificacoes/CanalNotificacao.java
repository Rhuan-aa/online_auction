package br.edu.ifsp.leilao.leitura.notificacoes;

@FunctionalInterface
public interface CanalNotificacao {
    void enviar(Notificacao notificacao);
}
