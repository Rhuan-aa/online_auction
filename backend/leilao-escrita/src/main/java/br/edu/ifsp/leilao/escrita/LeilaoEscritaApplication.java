package br.edu.ifsp.leilao.escrita;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication(scanBasePackages = {"br.edu.ifsp.leilao.escrita", "br.edu.ifsp.leilao.estado"})
@EnableScheduling
public class LeilaoEscritaApplication {
    public static void main(String[] args) {
        SpringApplication.run(LeilaoEscritaApplication.class, args);
    }
}
