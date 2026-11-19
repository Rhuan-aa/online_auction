package br.edu.ifsp.leilao.leitura;

import static com.tngtech.archunit.core.domain.JavaClass.Predicates.belongToAnyOf;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaCall;
import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.kafka.core.KafkaTemplate;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.leitura", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule camadas = layeredArchitecture().consideringOnlyDependenciesInLayers()
            .layer("api").definedBy("..leitura.api..")
            .layer("consultas").definedBy("..leitura.consultas..")
            .layer("notificacoes").definedBy("..leitura.notificacoes..")
            .whereLayer("api").mayNotBeAccessedByAnyLayer()
            .whereLayer("consultas").mayOnlyBeAccessedByLayers("api")
            .whereLayer("notificacoes").mayNotBeAccessedByAnyLayer();

    @ArchTest
    static final ArchRule notificacoesSoConhecemOsContratos = noClasses().that().resideInAPackage("..leitura.notificacoes..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..leitura.api..", "..leitura.consultas..", "..estado..", "org.springframework.web..",
                    "org.springframework.jdbc..", "org.springframework.data.redis..");

    @ArchTest
    static final ArchRule leituraNaoConheceAEscrita = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage("..escrita..", "..agendador..");

    @ArchTest
    static final ArchRule leituraNaoPublicaNoKafka = noClasses()
            .should().dependOnClassesThat(belongToAnyOf(KafkaTemplate.class))
            .orShould().dependOnClassesThat().resideInAPackage("org.apache.kafka.clients.producer..");

    @ArchTest
    static final ArchRule leituraNaoEscreveNoBanco = noClasses().should().callMethodWhere(
            new DescribedPredicate<JavaCall<?>>("escreve no banco por JdbcTemplate") {
                @Override
                public boolean test(JavaCall<?> chamada) {
                    return chamada.getTargetOwner().isAssignableTo(JdbcTemplate.class)
                            && Set.of("update", "batchUpdate", "execute").contains(chamada.getName());
                }
            });

    @ArchTest
    static final ArchRule redisSoNoCacheENaChecagemDeInfra = noClasses().that().doNotHaveSimpleName("ChecagemInfra")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework.data.redis..", "io.lettuce..");
}
