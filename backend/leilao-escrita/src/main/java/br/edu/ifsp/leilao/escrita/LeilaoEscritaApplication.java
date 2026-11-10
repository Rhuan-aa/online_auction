package br.edu.ifsp.leilao.escrita;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class LeilaoEscritaApplication {
    public static void main(String[] args) {
        SpringApplication.run(LeilaoEscritaApplication.class, args);
    }
}
