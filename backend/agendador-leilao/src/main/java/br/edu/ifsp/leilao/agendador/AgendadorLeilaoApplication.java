package br.edu.ifsp.leilao.agendador;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AgendadorLeilaoApplication {
    public static void main(String[] args) {
        SpringApplication.run(AgendadorLeilaoApplication.class, args);
    }
}
