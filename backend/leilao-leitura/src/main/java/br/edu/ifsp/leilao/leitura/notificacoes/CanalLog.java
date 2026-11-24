package br.edu.ifsp.leilao.leitura.notificacoes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class CanalLog implements CanalNotificacao {
    private static final Logger log = LoggerFactory.getLogger(CanalLog.class);

    @Override
    public void enviar(Notificacao n) {
        log.info("[notificação] para {}: {}", n.destinatarioId(), n.mensagem());
    }
}
