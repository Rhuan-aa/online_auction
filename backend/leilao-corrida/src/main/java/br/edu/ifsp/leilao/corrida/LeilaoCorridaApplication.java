package br.edu.ifsp.leilao.corrida;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Laboratório "corrida de arquiteturas" (porta 8085): o mesmo leilão, com a mesma sequência de
 * lances, roda ao mesmo tempo em 6 arquiteturas, e a tela acompanha as métricas por SSE.
 * Só para uso local: usa o superusuário do Postgres e não tem autenticação.
 */
@SpringBootApplication
public class LeilaoCorridaApplication {
    public static void main(String[] args) {
        SpringApplication.run(LeilaoCorridaApplication.class, args);
    }
}
