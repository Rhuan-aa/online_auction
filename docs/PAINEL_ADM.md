# Plano — Painel de ADM (simulação e desempenho)

> **Atualização:** o painel deixou de ser uma tela à parte (`#/adm` e `PainelAdm.tsx` foram removidos). A simulação e as checagens de integridade estão na aba **Integridade**, e a comparação A × B × C na aba **Desempenho** (veja `frontend/README.md`). A comparação não exige mais reiniciar nada: o botão "Comparar A × B × C" troca a configuração com `PUT /admin/cache/configuracao` nos dois serviços, roda a mesma simulação em cada uma e restaura a anterior. O restante deste texto descreve a lógica de medição, que continua valendo; os trechos sobre a tela e os arquivos são do desenho original.
>
> Status original: implementado em `#/adm` (`src/PainelAdm.tsx`, `src/simulacao.ts`, `src/historico.ts`, `src/Grafico.tsx`). Falta o ensaio com um leilão longo nas três configurações.

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
│ Leitores (consultas simultâneas) [4]   Semente [42]     [▶ Executar]   │
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
| Lances simultâneos (1–6) | Quantos POSTs ao mesmo tempo; é o que gera conflitos de versão. Limite: ver seção 6 |
| Preço inicial / faixa de incremento | O incremento mínimo do leilão = início da faixa |
| Leitores (1–6) | Consultas rodando **durante** os lances (o domínio tem muito mais leitura que escrita) |
| Lance acompanha o preço (padrão: ligado) | Envia o maior entre o valor planejado e o último preço conhecido (das respostas e dos leitores) + o incremento sorteado do lance. Desligado, o licitante que sobe mais rápido deixa os outros abaixo do mínimo, quase tudo é recusado e o leilão fica curto |
| Semente | Mesma semente = mesmos valores e mesma ordem dos lances. Aceitos e recusados dependem do tempo de resposta, então variam um pouco entre execuções |

### Como cada execução funciona
1. Lê a configuração ativa em `GET /admin/cache/configuracao` **nas duas portas**; se forem diferentes ou uma não responder, não executa.
2. `POST /leiloes` com início = agora − 2 s (absorve diferença de relógio com o servidor) e fim = agora + 10 min (longe do anti-sniping).
3. Espera o status `ABERTO` (o agendador abre o leilão). Sem isso em 15 s, mostra "o agendador está rodando?".
4. Dispara os lances com o número de simultâneos escolhido, mantendo a ordem de cada licitante.
5. Em paralelo, os leitores fazem `GET /leiloes/{id}`, guardando (tempo, nº de eventos do leilão).
6. Ao fim, espera a contagem da leitura parar de mudar (o ouvinte Kafka ainda está obtendo o estado; até 5 s), lê as métricas dos dois serviços (seção 3) e faz as checagens:
   - **Um vencedor:** líder e preço finais = autor e valor do último lance aceito.
   - **Trilha completa:** nº de lances em `GET /leiloes/{id}/lances` = nº de respostas `200`.
   - **Ordem:** versões e valores do histórico estritamente crescentes.

## 3. Configurações A, B e C (medição real)

| | Cópias ligadas | Como obtém o estado | Esperado |
|---|---|---|---|
| **A** | nenhuma | relê todos os eventos do leilão | tempo e eventos lidos **crescem** com o nº de lances |
| **B** | checkpoint | checkpoint + no máximo N eventos | eventos lidos limitados por N |
| **C** | Redis + checkpoint | cópia do Redis + 0 ou 1 evento | eventos lidos quase **constantes** |

A configuração inicial vem de `CACHE_CONFIGURACAO=A|B|C` e pode ser trocada em execução por `PUT /admin/cache/configuracao` (**a mesma na escrita e na leitura**; ligar o Redis limpa o Redis antes). Para comparar, roda-se a mesma simulação (mesma semente) uma vez em cada configuração, o que o botão da aba Desempenho faz sozinho; o histórico guarda as três. O código é o mesmo nas três: uma cópia desligada se comporta como vazia.

Métricas lidas pelo painel (as duas portas, `GET /actuator/metrics/<nome>?tag=...`, com CORS liberado para `http://localhost:5173`):

| Métrica | Tag | Uso no painel |
|---|---|---|
| `leilao.estado.obter` | `caminho:comando` (8081), `caminho:consulta` (8082) | tempo médio e máximo para obter o estado |
| `leilao.estado.eventos.lidos` | `base:redis`, `base:checkpoint`, `base:inicio`, `base:fonte` | eventos lidos por pedido; **acerto do cache** = `count(base:redis) / total` |

As métricas acumulam desde que o serviço subiu: o painel lê antes e depois da execução e usa a diferença (`ΔTOTAL / ΔCOUNT`). O `MAX` não entra, porque o Micrometer o calcula numa janela recente e ele não pode ser subtraído. Na leitura, as obtenções incluem as do ouvinte Kafka (uma por evento), além das consultas; o painel mostra as duas contagens.

**Expectativa (a confirmar no ensaio, ainda não medida nas três configurações):** os **eventos lidos** devem separar A, B e C em qualquer tamanho de leilão. O **tempo** só deve separá-las em leilões longos, como prevê o ADR-003: com poucos eventos, reler tudo é barato. Os números entram aqui depois do ensaio.

Primeiras execuções ao vivo (16/11, só configuração C, 20 × 10 lances, 6 simultâneos, 4 leitores, semente 42), as três checagens ✓ em todas:

| Lance acompanha o preço | Aceitos | Recusados | Conflitos (409) | Escrita p50 / p95 | Leitura p50 / p95 | Eventos lidos por obtenção (escrita) |
|---|---|---|---|---|---|---|
| desligado | 22 | 177 | 1 | 60 / 341 ms | 22 / 72 ms | 0,32 |
| ligado | 60 | 123 | 17 | 197 / 524 ms | 20 / 64 ms | 0,30 |

São leilões curtos (até ~60 eventos) e não servem de comparação entre configurações. Para um leilão longo, aumente os lances por licitante (com a opção ligada, cerca de 30% dos lances viram eventos).

## 4. Backend (pronto)

| Onde | O quê |
|---|---|
| módulo `estado` | `Configuracao` (A/B/C) e métricas no `ObterEstado` |
| `leilao-escrita` e `leilao-leitura` | `/actuator/metrics` exposto, tag `configuracao` em toda métrica, CORS do actuator para o front |

Rotas usadas: `POST /leiloes`, `POST /leiloes/{id}/lances`, `GET /leiloes/{id}`, `GET /leiloes/{id}/lances` e `/actuator/metrics`. O SSE **não** é necessário para o painel. A antiga rota de experimento "sem CQRS" saiu: a comparação agora é trocar a configuração (`/admin/cache/configuracao`).

## 5. Frontend (o mais simples possível)

Sem bibliotecas novas. React puro, CSS próprio, gráfico em SVG. Hoje essas peças vivem nas abas Integridade e Desempenho.

| Arquivo | Conteúdo |
|---|---|
| `src/api.ts` | `lerMetrica(servico, nome, tag)` para `/actuator/metrics`, além das rotas de sempre |
| `src/simulacao.ts` | Gerador com semente (mulberry32), plano de lances, disparo com N simultâneos sem dois do mesmo licitante ao mesmo tempo, leitores, p50/p95, checagens e diferença das métricas |
| `src/historico.ts` | Até 20 execuções no `localStorage` deste navegador; "mesma simulação" = mesmos parâmetros e semente |
| `src/Grafico.tsx` | Linhas em SVG: mediana do tempo no navegador por faixa de nº de eventos, uma por configuração (a última de cada uma com a mesma simulação) |
| `src/PainelAdm.tsx` | Formulário, resultado, gráfico (consultas ou lances) e histórico para comparar lado a lado |
| `test/simulacao.test.ts` | `npm test` (`node --test`, sem biblioteca): percentil, semente e checagens |

## 6. Limites (dizer se a banca perguntar)

- Os tempos do painel são medidos **no navegador** e incluem a rede local; as métricas do backend medem só o tempo para obter o estado. As duas visões juntas mostram onde o tempo está.
- O navegador abre ~6 conexões por porta, **somando todas as abas**. Escrita (8081) e leitura (8082) são portas diferentes, por isso os dois campos vão até 6: acima disso os pedidos esperariam na fila do navegador e o tempo medido incluiria a espera. Uma aba de detalhe aberta prende uma conexão SSE na 8082. Basta para gerar conflitos reais em demo, mas não é teste de carga de produção (para carga, use o `SimuladorLances`).
- As métricas são do serviço inteiro: outras abas, o agendador ou outro leilão rodando ao mesmo tempo entram na diferença. Rode o painel sozinho.
- Trocar de configuração não exige reiniciar, mas a troca é feita nos dois serviços; com o Redis fora do ar, a troca para C é recusada (503).
- O histórico fica só no navegador em que as execuções foram feitas.
- Cada execução cria um leilão de 10 min, que aparece na lista e é encerrado pelo agendador.

## 7. Próximos passos

1. Ensaiar com um leilão longo nas três configurações e registrar os números na seção 3.
