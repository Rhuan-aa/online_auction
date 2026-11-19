package br.edu.ifsp.leilao.agendador;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.agendador", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule agendadorSoConversaPorEventos = noClasses()
            .should().dependOnClassesThat().resideInAnyPackage(
                    "..escrita..", "..leitura..", "..estado..", "java.sql..", "org.springframework.jdbc..",
                    "org.springframework.data.redis..");
}
