package br.edu.ifsp.leilao.estado.cache;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.estado.cache", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule semDependenciaDosServicos = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..escrita..", "..leitura..", "..agendador..", "..ferramentas..", "org.springframework.web..",
                    "org.springframework.kafka..");

    @ArchTest
    static final ArchRule redisSoNoCache = noClasses().that().doNotHaveSimpleName("CacheEstadoLeilao")
            .should().dependOnClassesThat().resideInAnyPackage("org.springframework.data.redis..", "io.lettuce..");
}
