package br.edu.ifsp.leilao.escrita.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class CorsConfig implements WebMvcConfigurer {
    private final String origem;

    CorsConfig(@Value("${leilao.cors.origem:http://localhost:5173}") String origem) {
        this.origem = origem;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**").allowedOrigins(origem).allowedMethods("GET", "POST", "PUT");
    }
}
