package br.edu.ifsp.leilao.leitura;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = {"br.edu.ifsp.leilao.leitura", "br.edu.ifsp.leilao.estado"})
public class LeilaoLeituraApplication {
    public static void main(String[] args) {
        SpringApplication.run(LeilaoLeituraApplication.class, args);
    }
}
