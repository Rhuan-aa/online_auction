package br.edu.ifsp.leilao.corrida.motor;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * "Resultado correto?" de uma arquitetura, a partir dos lances confirmados como aceitos e do
 * estado final verdadeiro dela.
 *
 * <p><b>Lance perdido</b> (definição usada aqui): um lance confirmado ao cliente como aceito é
 * perdido se
 * <ol>
 *   <li>o valor dele ficou ACIMA do preço final (alguém gravou um valor menor por cima), ou</li>
 *   <li>outro lance aceito foi decidido sobre a MESMA versão base (lost update: os dois leram o
 *       mesmo estado e os dois gravaram, então só o efeito de um sobrevive). Em cada grupo de k
 *       lances com a mesma base, k - 1 são perdidos; o "sobrevivente" é o último confirmado.</li>
 * </ol>
 * Um lance que cai nos dois casos conta uma vez só. Nas arquiteturas com controle de
 * concorrência a base é única por construção (UNIQUE ou WHERE versao = ?), então o esperado é 0.
 */
public final class Integridade {

    private Integridade() {}

    /** Um lance confirmado como aceito. {@code ordem} = ordem global de confirmação. */
    public record LanceAceito(String licitante, long valor, int versaoBase, int versao, long ordem) {}

    public record Resultado(boolean ok, boolean umVencedor, boolean precoFinalCorreto, int lancesPerdidos,
                            String detalhe) {}

    public static int lancesPerdidos(Collection<LanceAceito> aceitos, long precoFinal) {
        Set<LanceAceito> perdidos = new HashSet<>();
        for (LanceAceito a : aceitos) {
            if (a.valor() > precoFinal) {
                perdidos.add(a);
            }
        }
        Map<Integer, List<LanceAceito>> porBase = aceitos.stream()
                .collect(Collectors.groupingBy(LanceAceito::versaoBase));
        for (List<LanceAceito> grupo : porBase.values()) {
            if (grupo.size() > 1) {
                List<LanceAceito> ordenado = new ArrayList<>(grupo);
                ordenado.sort(Comparator.comparingLong(LanceAceito::ordem));
                perdidos.addAll(ordenado.subList(0, ordenado.size() - 1));
            }
        }
        return perdidos.size();
    }

    public static Resultado avaliar(Collection<LanceAceito> aceitos, long precoInicial, long precoFinal,
                                    String liderFinal) {
        List<String> problemas = new ArrayList<>();
        boolean precoCorreto;
        boolean umVencedor;
        if (aceitos.isEmpty()) {
            precoCorreto = precoFinal == precoInicial;
            umVencedor = liderFinal == null;
            if (!precoCorreto) problemas.add("Nenhum lance aceito, mas o preço final é " + precoFinal + ".");
            if (!umVencedor) problemas.add("Nenhum lance aceito, mas há líder: " + liderFinal + ".");
        } else {
            long maior = aceitos.stream().mapToLong(LanceAceito::valor).max().orElseThrow();
            Set<String> autoresDoMaior = aceitos.stream().filter(a -> a.valor() == maior)
                    .map(LanceAceito::licitante).collect(Collectors.toSet());
            precoCorreto = precoFinal == maior;
            umVencedor = liderFinal != null && autoresDoMaior.size() == 1 && autoresDoMaior.contains(liderFinal);
            if (!precoCorreto) problemas.add("Preço final " + precoFinal + ", mas o maior lance aceito foi " + maior + ".");
            if (!umVencedor) {
                problemas.add("Líder final " + Objects.toString(liderFinal, "nenhum")
                        + ", mas o maior lance aceito é de " + String.join(", ", autoresDoMaior) + ".");
            }
        }
        int perdidos = lancesPerdidos(aceitos, precoFinal);
        if (perdidos > 0) {
            problemas.add(perdidos + " lance(s) aceito(s) perdido(s): sobrescrito(s) por outro decidido sobre o mesmo estado.");
        }
        boolean ok = precoCorreto && umVencedor && perdidos == 0;
        String detalhe = ok
                ? aceitos.size() + " lances aceitos; preço final = maior lance aceito; nenhum lance perdido."
                : String.join(" ", problemas);
        return new Resultado(ok, umVencedor, precoCorreto, perdidos, detalhe);
    }
}
