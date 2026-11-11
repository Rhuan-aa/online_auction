package br.edu.ifsp.leilao.leitura.projecoes;

import br.edu.ifsp.leilao.contratos.Topicos;
import jakarta.annotation.PreDestroy;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.apache.kafka.clients.admin.Admin;
import org.apache.kafka.clients.admin.ListOffsetsResult.ListOffsetsResultInfo;
import org.apache.kafka.clients.admin.OffsetSpec;
import org.apache.kafka.clients.consumer.OffsetAndMetadata;
import org.apache.kafka.common.TopicPartition;
import org.springframework.boot.health.contributor.Health;
import org.springframework.boot.health.contributor.HealthIndicator;
import org.springframework.kafka.core.KafkaAdmin;
import org.springframework.stereotype.Component;

/**
 * Aparece em GET /actuator/health como "lagProjecao".
 *
 * Lag = quantos eventos já estão no Kafka e a projeção ainda não processou
 *     = (fim do tópico) - (último offset confirmado pelo consumer group).
 * Lag 0 significa que o read model está em dia com o event store.
 */
@Component("lagProjecao")
public class LagProjecaoHealth implements HealthIndicator {

    private static final long TIMEOUT_SEGUNDOS = 3;

    private final Admin kafka;

    public LagProjecaoHealth(KafkaAdmin kafkaAdmin) {
        this.kafka = Admin.create(kafkaAdmin.getConfigurationProperties());
    }

    @PreDestroy
    void fechar() {
        kafka.close();
    }

    @Override
    public Health health() {
        try {
            return Health.up().withDetail("lag", calcularLag()).build();
        } catch (Exception e) {
            return Health.down(e).build(); // Kafka fora do ar ou lento demais
        }
    }

    private long calcularLag() throws Exception {
        List<TopicPartition> particoes = particoesDoTopico();
        Map<TopicPartition, ListOffsetsResultInfo> fim = offsetsNoFim(particoes);
        Map<TopicPartition, OffsetAndMetadata> processados = offsetsProcessados();

        long lag = 0;
        for (TopicPartition particao : particoes) {
            lag += fim.get(particao).offset() - offsetProcessado(processados, particao);
        }
        return lag;
    }

    private List<TopicPartition> particoesDoTopico() throws Exception {
        return kafka.describeTopics(List.of(Topicos.EVENTOS_LEILAO)).allTopicNames()
                .get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS).get(Topicos.EVENTOS_LEILAO).partitions().stream()
                .map(p -> new TopicPartition(Topicos.EVENTOS_LEILAO, p.partition()))
                .toList();
    }

    /** Até onde o Kafka tem eventos em cada partição. */
    private Map<TopicPartition, ListOffsetsResultInfo> offsetsNoFim(List<TopicPartition> particoes) throws Exception {
        Map<TopicPartition, OffsetSpec> pedido = new HashMap<>();
        particoes.forEach(particao -> pedido.put(particao, OffsetSpec.latest()));
        return kafka.listOffsets(pedido).all().get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS);
    }

    /** Até onde a projeção já processou (confirmado pelo consumer group). */
    private Map<TopicPartition, OffsetAndMetadata> offsetsProcessados() throws Exception {
        return kafka.listConsumerGroupOffsets(OuvinteProjecao.GRUPO)
                .partitionsToOffsetAndMetadata().get(TIMEOUT_SEGUNDOS, TimeUnit.SECONDS);
    }

    /** Partição sem confirmação ainda não processou nada: conta como 0. */
    private static long offsetProcessado(Map<TopicPartition, OffsetAndMetadata> processados, TopicPartition particao) {
        OffsetAndMetadata confirmado = processados.get(particao);
        return confirmado == null ? 0 : confirmado.offset();
    }
}
