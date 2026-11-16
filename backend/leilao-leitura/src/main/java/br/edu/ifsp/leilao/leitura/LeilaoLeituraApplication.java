package br.edu.ifsp.leilao.leitura;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Além do próprio pacote, procura beans no módulo estado (ObterEstado, cache, checkpoint, eventos). */
@SpringBootApplication(scanBasePackages = {"br.edu.ifsp.leilao.leitura", "br.edu.ifsp.leilao.estado"})
public class LeilaoLeituraApplication {
    public static void main(String[] args) {
        SpringApplication.run(LeilaoLeituraApplication.class, args);
    }
}
