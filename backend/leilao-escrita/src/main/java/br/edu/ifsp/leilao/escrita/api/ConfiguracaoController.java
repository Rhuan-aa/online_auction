package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.estado.Configuracao;
import br.edu.ifsp.leilao.estado.ConfiguracaoAtiva;
import br.edu.ifsp.leilao.estado.TrocaDeConfiguracao;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

/**
 * Painel de ADM: lê e troca a configuração A/B/C do cache deste serviço sem reiniciar.
 * A troca passa por TrocaDeConfiguracao (limpa o Redis ao ligá-lo), nunca direto em ConfiguracaoAtiva.
 */
@RestController
@RequestMapping("/admin/cache/configuracao")
@CrossOrigin(origins = "http://localhost:5173", methods = {RequestMethod.GET, RequestMethod.PUT})
public class ConfiguracaoController {

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
            // a limpeza do Redis falhou: a configuração não mudou
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("erro", "REDIS_INDISPONIVEL",
                    "mensagem", "Não foi possível limpar o Redis; a configuração continua " + ativa.atual() + "."));
        }
    }
}
