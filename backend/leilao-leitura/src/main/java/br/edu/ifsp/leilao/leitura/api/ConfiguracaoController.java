package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.estado.Configuracao;
import br.edu.ifsp.leilao.estado.ConfiguracaoAtiva;
import br.edu.ifsp.leilao.estado.TrocaDeConfiguracao;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/cache/configuracao")
public class ConfiguracaoController {
    private static final Logger log = LoggerFactory.getLogger(ConfiguracaoController.class);

    public record ConfiguracaoDto(Configuracao configuracao) {}

    private final ConfiguracaoAtiva ativa;
    private final TrocaDeConfiguracao troca;

    public ConfiguracaoController(ConfiguracaoAtiva ativa, TrocaDeConfiguracao troca) {
        this.ativa = ativa;
        this.troca = troca;
    }

    @GetMapping
    public ConfiguracaoDto atual() {
        return new ConfiguracaoDto(ativa.atual());
    }

    @PutMapping
    public ResponseEntity<?> trocar(@RequestBody ConfiguracaoDto corpo) {
        if (corpo == null || corpo.configuracao() == null) {
            return ResponseEntity.badRequest().body(Map.of("erro", "CONFIGURACAO_INVALIDA",
                    "mensagem", "Informe a configuração: A, B ou C."));
        }
        try {
            return ResponseEntity.ok(new ConfiguracaoDto(troca.trocar(corpo.configuracao())));
        } catch (RuntimeException e) {
            log.warn("Troca para {} falhou ao limpar o Redis; configuração continua {}", corpo.configuracao(), ativa.atual(), e);
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("erro", "REDIS_INDISPONIVEL",
                    "mensagem", "Não foi possível limpar o Redis; a configuração continua " + ativa.atual() + "."));
        }
    }
}
