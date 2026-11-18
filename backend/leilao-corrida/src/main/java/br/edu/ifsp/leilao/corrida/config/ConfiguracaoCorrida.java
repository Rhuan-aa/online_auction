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
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaEsCqrs;
import br.edu.ifsp.leilao.corrida.arquiteturas.ArquiteturaEsSnapshot;
import java.util.List;

@Configuration
public class ConfiguracaoCorrida implements WebMvcConfigurer {

    /** Tópico só do es-cqrs; o Kafka local não cria tópicos sozinho. Criado pelo KafkaAdmin na subida. */
    @Bean
    NewTopic topicoCorridaCqrs() {
        return new NewTopic(ArquiteturaEsCqrs.TOPICO, 3, (short) 1);
    }

    @Bean
    ArquiteturaEsCqrs arquiteturaEsCqrs(Esquema esquema, Conexoes conexoes,
                                        KafkaTemplate<String, String> kafka, JsonMapper json) {
        return new ArquiteturaEsCqrs(conexoes.para(ArquiteturaEsCqrs.ID), conexoes.para(ArquiteturaEsCqrs.ID + "-projecao"),
                kafka, json);
    }

    /** As 6, na ordem do contrato. O Esquema entra como parâmetro para o DDL rodar antes. */
    @Bean
    List<Arquitetura> arquiteturas(Esquema esquema, Conexoes conexoes, StringRedisTemplate redis,
                                   ArquiteturaEsCqrs esCqrs) {
        return List.of(
                new ArquiteturaCrud(conexoes.para(ArquiteturaCrud.ID)),
                new ArquiteturaCrudCache(conexoes.para(ArquiteturaCrudCache.ID), redis),
                new ArquiteturaEs(conexoes.para(ArquiteturaEs.ID)),
                new ArquiteturaEsSnapshot(conexoes.para(ArquiteturaEsSnapshot.ID)),
                new ArquiteturaEsCache(conexoes.para(ArquiteturaEsCache.ID), redis),
                esCqrs);
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
