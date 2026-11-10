package br.edu.ifsp.leilao.escrita;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.escrita")
class ArchitectureTest {
    @ArchTest
    static final ArchRule domainIsPure = noClasses().that().resideInAPackage("..escrita.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "java.sql..", "org.apache.kafka..",
                    "..infrastructure..", "..api..")
            .allowEmptyShould(true);
}
