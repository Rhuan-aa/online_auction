package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.estado.ReconstrucaoCache;
import br.edu.ifsp.leilao.estado.ReconstrucaoCache.Relatorio;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/cache/reconstruir")
@CrossOrigin(origins = "http://localhost:5173", methods = RequestMethod.POST)
public class ReconstrucaoController {
    private final ReconstrucaoCache reconstrucao;

    public ReconstrucaoController(ReconstrucaoCache reconstrucao) {
        this.reconstrucao = reconstrucao;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public Relatorio reconstruir() {
        return reconstrucao.reconstruir();
    }
}
