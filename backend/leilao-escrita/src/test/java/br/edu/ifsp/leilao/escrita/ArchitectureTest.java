package br.edu.ifsp.leilao.escrita;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;
import static com.tngtech.archunit.library.Architectures.layeredArchitecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.escrita", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule domainIsPure = noClasses().that().resideInAPackage("..escrita.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "java.sql..", "org.apache.kafka..", "tools.jackson..",
                    "..infrastructure..", "..api..", "..application..", "..estado.cache..");

    @ArchTest
    static final ArchRule camadas = layeredArchitecture().consideringOnlyDependenciesInLayers()
            .layer("api").definedBy("..escrita.api..")
            .layer("application").definedBy("..escrita.application..")
            .layer("domain").definedBy("..escrita.domain..")
            .layer("infrastructure").definedBy("..escrita.infrastructure..")
            .whereLayer("api").mayNotBeAccessedByAnyLayer()
            .whereLayer("infrastructure").mayNotBeAccessedByAnyLayer()
            .whereLayer("application").mayOnlyBeAccessedByLayers("api", "infrastructure")
            .whereLayer("domain").mayOnlyBeAccessedByLayers("api", "application", "infrastructure");

    @ArchTest
    static final ArchRule somenteOOutboxPublicaNoKafka = noClasses().that().resideOutsideOfPackage("..escrita.infrastructure..")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework.kafka.core..", "org.apache.kafka.clients.producer..");

    @ArchTest
    static final ArchRule somenteAInfraFalaComOBanco = noClasses().that().resideOutsideOfPackage("..escrita.infrastructure..")
            .should().dependOnClassesThat().resideInAnyPackage("java.sql..", "org.springframework.jdbc..", "org.postgresql..");

    @ArchTest
    static final ArchRule redisSoPeloModuloDeEstado = noClasses().should().dependOnClassesThat()
            .resideInAnyPackage("org.springframework.data.redis..", "io.lettuce..");

    @ArchTest
    static final ArchRule naoConheceALeituraNemOAgendador = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage("..leitura..", "..agendador..");
}
