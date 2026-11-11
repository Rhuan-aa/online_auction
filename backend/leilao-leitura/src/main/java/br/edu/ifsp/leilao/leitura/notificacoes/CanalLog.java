package br.edu.ifsp.leilao.leitura.notificacoes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/** Envio simulado: escreve o aviso no log do serviço. */
@Component
public class CanalLog implements CanalNotificacao {

    private static final Logger log = LoggerFactory.getLogger(CanalLog.class);

    @Override
    public void enviar(String destinatarioId, String mensagem) {
        log.info("[notificação] para {}: {}", destinatarioId, mensagem);
    }
}
