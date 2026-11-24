package br.edu.ifsp.leilao.corrida.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import tools.jackson.databind.json.JsonMapper;
import br.edu.ifsp.leilao.corrida.arquiteturas.Arquitetura;
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaCrud;
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaCrudCache;
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaEs;
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaEsCache;
// Removed import of ArquiteturaEsCqrs as CQRS architecture is no longer used


import java.util.List;

@Configuration
public class ConfiguracaoCorrida implements WebMvcConfigurer {
// Removed CQRS related beans (NewTopic and ArquiteturaEsCqrs) as CQRS is no longer used

    @Bean
    List<Arquitetura> arquiteturas(Esquema esquema, Conexoes conexoes, StringRedisTemplate redis) {
        return List.of(
                new ArquiteturaCrud(conexoes.para(ArquiteturaCrud.ID)),
                new ArquiteturaCrudCache(conexoes.para(ArquiteturaCrudCache.ID), redis),
                new ArquiteturaEs(conexoes.para(ArquiteturaEs.ID)),
                new ArquiteturaEsCache(conexoes.para(ArquiteturaEsCache.ID), redis)
        );
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        for (String caminho : new String[] {"/corrida", "/corrida/**"}) {
            registry.addMapping(caminho)
                    .allowedOrigins("http://localhost:5173")
                    .allowedMethods("GET", "POST");
        }
    }
}
