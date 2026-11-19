package br.edu.ifsp.leilao.leitura.api;

import br.edu.ifsp.leilao.leitura.consultas.ChecagemInfra;
import br.edu.ifsp.leilao.leitura.consultas.ChecagemInfra.Componente;
import java.util.Map;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
public class InfraController {
    private final ChecagemInfra checagem;

    public InfraController(ChecagemInfra checagem) {
        this.checagem = checagem;
    }

    @GetMapping("/infra/saude")
    public Map<String, Componente> saude() {
        return checagem.checar();
    }
}
