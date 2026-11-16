# Plano — Painel de ADM (simulação e desempenho)

> Status: **planejado, implementação pausada.** O backend já tem tudo o que o painel precisa (configurações A/B/C e métricas); falta a tela.

## 1. Objetivo

Uma tela de administração para **demonstrar a arquitetura**, ao lado das telas de usuário (lista, detalhe, criar leilão). O ADM configura uma simulação de leilão, o painel dispara lances e mostra, medido de verdade:

- **Integridade:** um único vencedor e nenhum lance aceito perdido.
- **Desempenho:** tempo para obter o estado e eventos lidos por pedido, **nas configurações A, B e C** do cache (ADR-003).

Não há mais métrica de "consistência eventual": sem banco de leitura separado, a leitura usa o mesmo estado da escrita (ver PLANO.md, seção 1).

## 2. A tela

```
┌─ SIMULAÇÃO ────────────────────────────────────────────────────────────┐
│ Licitantes [20]  Lances por licitante [10]  Lances simultâneos [6]     │
│ Preço inicial [R$ 100]  Incremento aleatório [R$ 1 a R$ 50]            │
│ Leitores (consultas simultâneas) [10]  Semente [42]     [▶ Executar]   │
├─ RESULTADO (configuração ativa: C) ────────────────────────────────────┤
│ INTEGRIDADE   aceitos · recusados · conflitos | 1 vencedor ✓ | trilha ✓│
│ ESCRITA       p50 · p95 · lances/s · eventos lidos por lance           │
│ LEITURA       p50 · p95 · eventos lidos por consulta · acerto do cache │
│ GRÁFICO       tempo × nº de eventos do leilão (uma linha por config.)  │
├─ HISTÓRICO ────────────────────────────────────────────────────────────┤
│ execuções anteriores (A, B, C), para comparar lado a lado              │
└────────────────────────────────────────────────────────────────────────┘
```

### Parâmetros
| Campo | Para quê |
|---|---|
| Licitantes | `licitante-1` … `licitante-N` |
| Lances por licitante | Cada licitante dá lances **crescentes** (passeio aleatório próprio), para haver aceitos e recusados |
| Lances simultâneos | Quantos POSTs ao mesmo tempo; é o que gera conflitos de versão |
| Preço inicial / faixa de incremento | O incremento mínimo do leilão = início da faixa |
| Leitores | Consultas rodando **durante** os lances (o domínio tem muito mais leitura que escrita) |
| Semente | Mesma semente = mesma simulação (para ensaiar a apresentação e comparar configurações) |

### Como cada execução funciona
1. Lê a configuração ativa em `GET /actuator/metrics/leilao.estado.obter` (tag `configuracao`).
2. `POST /leiloes` com início = agora e fim = agora + 10 min (longe do anti-sniping).
3. Espera o status `ABERTO` (o agendador abre o leilão). Sem isso em 15 s, mostra "o agendador está rodando?".
4. Dispara os lances com o número de simultâneos escolhido, mantendo a ordem de cada licitante.
5. Em paralelo, os leitores fazem `GET /leiloes/{id}`, guardando (tempo, nº de eventos do leilão).
6. Ao fim, lê as métricas dos dois serviços (seção 3) e faz as checagens:
   - **Um vencedor:** líder e preço finais = autor e valor do último lance aceito.
   - **Trilha completa:** nº de lances em `GET /leiloes/{id}/lances` = nº de respostas `200`.
   - **Ordem:** versões e valores do histórico estritamente crescentes.

## 3. Configurações A, B e C (medição real)

| | Cópias ligadas | Como obtém o estado | Esperado |
|---|---|---|---|
| **A** | nenhuma | relê todos os eventos do leilão | tempo e eventos lidos **crescem** com o nº de lances |
| **B** | checkpoint | checkpoint + no máximo N eventos | eventos lidos limitados por N |
| **C** | Redis + checkpoint | cópia do Redis + 0 ou 1 evento | eventos lidos quase **constantes** |

A configuração é escolhida ao subir os serviços: `CACHE_CONFIGURACAO=A|B|C`, **a mesma na escrita e na leitura**. Para comparar, roda-se a mesma simulação (mesma semente) uma vez em cada configuração; o histórico guarda as três. O código é o mesmo nas três: uma cópia desligada se comporta como vazia.

Métricas lidas pelo painel (as duas portas, `GET /actuator/metrics/<nome>?tag=...`, com CORS liberado para `http://localhost:5173`):

| Métrica | Tag | Uso no painel |
|---|---|---|
| `leilao.estado.obter` | `caminho:comando` (8081), `caminho:consulta` (8082) | tempo médio e máximo para obter o estado |
| `leilao.estado.eventos.lidos` | `base:redis`, `base:checkpoint`, `base:inicio`, `base:fonte` | eventos lidos por pedido; **acerto do cache** = `count(base:redis) / total` |

As métricas acumulam desde que o serviço subiu: o painel lê antes e depois da execução e usa a diferença.

**Resultado de uma medição manual (para calibrar a expectativa):** num leilão de ~100 eventos com 20 bots, C leu ~0,7 evento por lance contra ~50 em A, mas A teve menor tempo médio, porque reler 100 eventos é barato e, sem cópia, pedidos simultâneos dividem a mesma reconstrução. Como o ADR-003 prevê, o ganho de tempo do cache aparece em **leilões longos** (milhares de eventos), muito lidos ou após reinícios. Na demo, use um leilão longo e mostre também os **eventos lidos**, que separam as configurações em qualquer tamanho.

## 4. Backend (pronto)

| Onde | O quê |
|---|---|
| módulo `estado` | `Configuracao` (A/B/C) e métricas no `ObterEstado` |
| `leilao-escrita` e `leilao-leitura` | `/actuator/metrics` exposto, tag `configuracao` em toda métrica, CORS do actuator para o front |

Rotas usadas: `POST /leiloes`, `POST /leiloes/{id}/lances`, `GET /leiloes/{id}`, `GET /leiloes/{id}/lances` e `/actuator/metrics`. O SSE **não** é necessário para o painel. A antiga rota de experimento "sem CQRS" saiu: a comparação agora é trocar a configuração.

## 5. Frontend (o mais simples possível)

Sem bibliotecas novas. React puro, CSS próprio, gráfico em SVG. Uma tela a mais (`#/adm`).

| Arquivo | Conteúdo | Status |
|---|---|---|
| `src/api.ts` | `criarLeilao`, `darLance`, `consultarLeilao` (com `versaoMinima`), `historicoLances`; falta uma função para ler `/actuator/metrics` | ✅ quase pronto |
| `src/simulacao.ts` | Gera os lances com semente, executa com N simultâneos, roda os leitores, calcula p50/p95 e as checagens | a fazer |
| `src/PainelAdm.tsx` | Formulário, resultado, gráfico e histórico | a fazer |

## 6. Limites (dizer se a banca perguntar)

- Os tempos do painel são medidos **no navegador** e incluem a rede local; as métricas do backend medem só o tempo para obter o estado. As duas visões juntas mostram onde o tempo está.
- O navegador abre ~6 conexões por porta. Basta para gerar conflitos reais em demo, mas não é teste de carga de produção (para carga, use o `SimuladorLances`).
- Trocar de configuração exige reiniciar escrita e leitura.

## 7. Próximos passos

1. Função de métricas no `api.ts`.
2. `simulacao.ts` e `PainelAdm.tsx`.
3. Ensaiar com um leilão longo nas três configurações.
