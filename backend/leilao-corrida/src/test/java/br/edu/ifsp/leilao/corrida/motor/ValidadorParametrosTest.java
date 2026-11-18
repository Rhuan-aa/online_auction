package br.edu.ifsp.leilao.corrida.motor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import br.edu.ifsp.leilao.corrida.motor.ValidadorParametros.ParametroInvalidoException;
import br.edu.ifsp.leilao.corrida.motor.ValidadorParametros.Pedido;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class ValidadorParametrosTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String OK =
            "\"licitantes\":20,\"lancesPorLicitante\":10,\"simultaneos\":6,\"leitores\":4,\"precoInicial\":10000,\"incremento\":100";

    private static Pedido validar(String json) {
        return ValidadorParametros.validar(JSON.readTree(json), 42);
    }

    private static void invalido(String json) {
        assertThrows(ParametroInvalidoException.class, () -> validar(json), json);
    }

    @Test
    void aceitaOExemploDoContrato() {
        Pedido p = validar("{" + OK + "}");
        assertEquals(new Parametros(20, 10, 6, 4, 10_000, 100), p.parametros());
        assertEquals(42, p.semente());
        assertEquals(200, p.parametros().totalLances());
    }

    @Test
    void semLimiteMaximoELeitoresPodeSerZero() {
        Pedido p = validar("{\"licitantes\":5000,\"lancesPorLicitante\":1000,\"simultaneos\":500,\"leitores\":0,"
                + "\"precoInicial\":1,\"incremento\":1,\"semente\":7}");
        assertEquals(0, p.parametros().leitores());
        assertEquals(7, p.semente());
    }

    @Test
    void recusaZeroNegativoFracaoTextoEFaltando() {
        invalido("{" + OK.replace("\"licitantes\":20", "\"licitantes\":0") + "}");
        invalido("{" + OK.replace("\"simultaneos\":6", "\"simultaneos\":0") + "}");
        invalido("{" + OK.replace("\"leitores\":4", "\"leitores\":-1") + "}");
        invalido("{" + OK.replace("\"incremento\":100", "\"incremento\":0") + "}");
        invalido("{" + OK.replace("\"precoInicial\":10000", "\"precoInicial\":100.5") + "}");
        invalido("{" + OK.replace("\"lancesPorLicitante\":10", "\"lancesPorLicitante\":\"10\"") + "}");
        invalido("{" + OK.replace(",\"leitores\":4", "") + "}");
        invalido("{" + OK.replace("\"licitantes\":20", "\"licitantes\":null") + "}");
        invalido("[]");
        assertThrows(ParametroInvalidoException.class, () -> ValidadorParametros.validar(null, 42));
    }

    @Test
    void recusaOQueNaoCabeNosTipos() {
        invalido("{" + OK.replace("\"licitantes\":20", "\"licitantes\":3000000000") + "}");
        // 50000 x 50000 lances não cabe em int
        invalido("{" + OK.replace("\"licitantes\":20", "\"licitantes\":50000")
                .replace("\"lancesPorLicitante\":10", "\"lancesPorLicitante\":50000") + "}");
        invalido("{" + OK.replace("\"incremento\":100", "\"incremento\":9000000000000000000") + "}");
    }
}
