package br.edu.ifsp.leilao.estado;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/**
 * O módulo estado tem classes com Spring e banco (LeitorEventos), mas o EstadoLeilao precisa
 * continuar Java puro: o domínio da escrita (Leilao) depende dele.
 */
@AnalyzeClasses(packages = "br.edu.ifsp.leilao.estado", importOptions = ImportOption.DoNotIncludeTests.class)
class ArchitectureTest {
    @ArchTest
    static final ArchRule estadoLeilaoEhPuro = noClasses().that().haveSimpleNameStartingWith("EstadoLeilao")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "java.sql..", "org.apache.kafka..", "tools.jackson..");
}
