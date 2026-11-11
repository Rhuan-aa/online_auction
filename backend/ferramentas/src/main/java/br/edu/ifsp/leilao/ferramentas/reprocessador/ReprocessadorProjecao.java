package br.edu.ifsp.leilao.ferramentas.reprocessador;

import br.edu.ifsp.leilao.contratos.Topicos;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.kafka.core.KafkaAdmin;

/**
 * Reconstrói o read model do zero, só com os eventos que estão no Kafka.
 * Prova do Event Sourcing: as tabelas de consulta são descartáveis, a verdade são os eventos.
 *
 * Passos (pare o serviço leilao-leitura antes: um grupo ativo não aceita reposicionamento):
 *   1) apaga as três tabelas do read_model;
 *   2) volta o consumer group da projeção para o offset 0 de cada partição.
 * Ao subir o leilao-leitura de novo, ele relê o tópico inteiro e refaz as tabelas.
 */
@SpringBootApplication
public class ReprocessadorProjecao implements CommandLineRunner {

    /** Mesmo nome de OuvinteProjecao.GRUPO (em leilao-leitura, módulo que esta ferramenta não importa). */
    private static final String GRUPO = "leilao-leitura-projecoes";
    private static final long TIMEOUT_SEGUNDOS = 10;

    private final JdbcClient jdbc;
    private final KafkaAdmin kafkaAdmin;

    public ReprocessadorProjecao(JdbcClient jdbc, KafkaAdmin kafkaAdmin) {
        this.jdbc = jdbc;
        this.kafkaAdmin = kafkaAdmin;
    }

    public static void main(String[] args) {
        SpringApplication.run(ReprocessadorProjecao.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        apagarProjecao();
        voltarParaOInicio();
        System.out.println("Pronto. Suba o leilao-leitura: ele vai reler todos os eventos e refazer as tabelas.");
    }

    private void apagarProjecao() {
        jdbc.sql("TRUNCATE read_model.catalogo_leiloes, read_model.historico_lances, read_model.atividade_licitantes")
                .update();
        System.out.println("Tabelas do read_model apagadas.");
    }

    private void voltarParaOInicio() throws Exception {
        try (Admin kafka = Admin.create(kafkaAdmin.getConfigurationProperties())) {
            List<TopicPartition> particoes = particoesDoTopico(kafka);
            Map<TopicPartition, OffsetAndMetadata> offsetsIniciais = offsetsIniciais(kafka, particoes);

            kafka.alterConsumerGroupOffsets(GRUPO, offsetsIniciais).all().get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS);
            System.out.println("Consumer group '" + GRUPO + "' voltou ao início de " + particoes.size() + " partições.");
        }
    }

    private static List<TopicPartition> particoesDoTopico(Admin kafka) throws Exception {
        return kafka.describeTopics(List.of(Topicos.EVENTOS_LEILAO)).allTopicNames()
                .get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS).get(Topicos.EVENTOS_LEILAO).partitions().stream()
                .map(p -> new TopicPartition(Topicos.EVENTOS_LEILAO, p.partition()))
                .toList();
    }

    /** O primeiro offset ainda existente de cada partição (normalmente 0). */
    private static Map<TopicPartition, OffsetAndMetadata> offsetsIniciais(Admin kafka, List<TopicPartition> particoes)
            throws Exception {
        Map<TopicPartition, OffsetSpec> pedido = new HashMap<>();
        particoes.forEach(particao -> pedido.put(particao, OffsetSpec.earliest()));

        Map<TopicPartition, OffsetAndMetadata> iniciais = new HashMap<>();
        kafka.listOffsets(pedido).all().get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS)
                .forEach((particao, info) -> iniciais.put(particao, new OffsetAndMetadata(info.offset())));
        return iniciais;
    }
}
