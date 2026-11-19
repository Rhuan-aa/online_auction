package br.edu.ifsp.leilao.escrita.api;

import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache;
import br.edu.ifsp.leilao.estado.cache.ReconstrucaoCache.Relatorio;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/cache/reconstruir")
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
