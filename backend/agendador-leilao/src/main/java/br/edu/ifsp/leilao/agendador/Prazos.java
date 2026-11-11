package br.edu.ifsp.leilao.agendador;

import br.edu.ifsp.leilao.contratos.ComandoAgendador;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Guarda, em memória, o início e o fim de cada leilão em andamento e diz quais prazos venceram.
 * Não fala com Kafka: só recebe fatos (registrar, aberto, prorrogado, terminado) e devolve comandos.
 *
 * Os métodos são synchronized porque o ouvinte (thread do Kafka) e o relógio (thread do
 * agendamento) usam o mesmo mapa ao mesmo tempo.
 */
@Component
public class Prazos {

    public static final String INICIAR = "IniciarLeilao";
    public static final String ENCERRAR = "EncerrarLeilao";

    private static final class Prazo {
        Instant inicioEm;
        Instant fimEm;
        boolean aberto;
        boolean inicioEnviado;
        boolean fimEnviado;
    }

    private final Map<UUID, Prazo> prazos = new HashMap<>();

    public synchronized void registrar(UUID leilaoId, Instant inicioEm, Instant fimEm) {
        Prazo p = new Prazo();
        p.inicioEm = inicioEm;
        p.fimEm = fimEm;
        prazos.put(leilaoId, p);
    }

    public synchronized void aberto(UUID leilaoId) {
        Prazo p = prazos.get(leilaoId);
        if (p != null) {
            p.aberto = true;
        }
    }

    /** Anti-sniping: o fim mudou, então o encerramento precisa ser enviado de novo no novo horário. */
    public synchronized void prorrogado(UUID leilaoId, Instant novoFimEm) {
        Prazo p = prazos.get(leilaoId);
        if (p != null) {
            p.fimEm = novoFimEm;
            p.fimEnviado = false;
        }
    }

    /** Leilão encerrado ou cancelado: não há mais nada a agendar. */
    public synchronized void terminado(UUID leilaoId) {
        prazos.remove(leilaoId);
    }

    /** Comandos cujo horário chegou. Cada comando sai uma única vez por prazo. */
    public synchronized List<ComandoAgendador> vencidos(Instant agora) {
        List<ComandoAgendador> comandos = new ArrayList<>();
        prazos.forEach((leilaoId, p) -> {
            if (!p.aberto && !p.inicioEnviado && !agora.isBefore(p.inicioEm)) {
                p.inicioEnviado = true;
                comandos.add(new ComandoAgendador(INICIAR, leilaoId, agora));
            }
            if (p.aberto && !p.fimEnviado && !agora.isBefore(p.fimEm)) {
                p.fimEnviado = true;
                comandos.add(new ComandoAgendador(ENCERRAR, leilaoId, agora));
            }
        });
        return comandos;
    }
}
