package br.edu.ifsp.leilao.auctioncommand;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

@AnalyzeClasses(packages = "br.edu.ifsp.leilao.auctioncommand")
class ArchitectureTest {
    @ArchTest
    static final ArchRule domainIsPure = noClasses().that().resideInAPackage("..auctioncommand.domain..")
            .should().dependOnClassesThat().resideInAnyPackage(
                    "org.springframework..", "java.sql..", "org.apache.kafka..",
                    "..infrastructure..", "..api..")
            .allowEmptyShould(true);
}
