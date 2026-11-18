# Design: novo front para a apresentação em sala

Data: 18/11/2026 · Status: rascunho para aprovação

## 1. Intenção

O front será apresentado **ao vivo, em sala**: a equipe apresenta e o professor e os alunos assistem pelo projetor. O objetivo é que o sistema **ensine** a arquitetura escolhida (EDA com broker, Event Sourcing e cache versionado) e mostre por que ela foi escolhida, provando cada característica arquitetural com dado real do sistema rodando:

- **Integridade sob concorrência** (característica central)
- **Desempenho**
- **Auditabilidade**

O front também explica visualmente as alternativas descartadas (CRUD, CQRS, REST síncrono, RabbitMQ).

O pedido: o visual deve ficar mais bonito e moderno sem perder a simplicidade do projeto; deve ser **o mais interativo possível**; deve ser rico em informação (gráficos, comparações, desempenho, consumo de rede); e deve ganhar novas cores, fontes e layout.

## 2. Objetivos, não-objetivos e anti-objetivos

**Objetivos**
- Uma tela única com o **palco** (leilão ao vivo, sempre visível) e **abas de análise**: Integridade, Desempenho, Rede, Auditoria, Arquitetura e "E se fosse…?".
- Todo número exibido vem do sistema: backend ou medição no navegador.
- Interação direta: tudo o que o apresentador dispara numa aba mexe o palco ao lado.
- Legível no projetor: tipografia grande, alto contraste e pouco texto por bloco.

**Não-objetivos**
- Login real, multiusuário de verdade e responsividade fina para celular. A tela deve funcionar num notebook ligado ao projetor; o celular só precisa não quebrar.
- Medir arquiteturas alternativas de verdade: elas são **explicadas**, não implementadas.
- Mexer nas regras de negócio do leilão.

**Anti-objetivos**, que tornariam o trabalho um fracasso mesmo funcionando:
- Mostrar número inventado ou "de exemplo" como se fosse medição. Toda ilustração leva o selo **"ilustração"**.
- Virar um dashboard poluído: cada bloco responde a **uma** pergunta que a sala faria.
- Depender de internet na sala: fontes e assets devem funcionar offline.
- Quebrar as regras de arquitetura do README: a leitura nunca grava no Event Store, `leilao-leitura` não depende de `leilao-escrita` e o ArchUnit continua verde.

## 3. Restrições

- **Stack atual:** React 19, Vite e TypeScript, sem biblioteca de UI, gráfico ou rotas. A navegação é por hash.
- **Usuários fixos:** `vendedor-1` e `licitante-1..3`. Só o vendedor cria e cancela leilões.
- `frontend/src/types.ts` espelha `backend/contratos`: mudou um, muda o outro no mesmo PR (DIVISAO.md).
- **CORS:** o front roda em `http://localhost:5173`.
- O navegador abre cerca de 6 conexões por porta, limite já tratado em `simulacao.ts`.
- **A configuração A/B/C do cache** hoje é escolhida ao subir os serviços (`CACHE_CONFIGURACAO`) e precisa ser a mesma na escrita e na leitura. Trocar exige reiniciar os dois. **Isso muda** neste projeto: ela passa a ser trocável em tempo de execução (seção 8, item 6). A propriedade continua definindo apenas o valor inicial.

## 4. Abordagens consideradas

| # | Abordagem | Trade-off |
|---|---|---|
| 1 | Só front, zero bibliotecas, nenhuma mudança no backend | Mais simples, mas a Auditoria mostraria só lances, sem viagem no tempo real; a saúde cobriria só 8081/8082; a reconstrução ficaria só explicada. |
| **2** | **Front sem bibliotecas + acréscimos pequenos no backend** | Entrega todas as abas com dado real. Gráficos e animações em SVG/CSS feitos à mão, como o `Grafico.tsx` atual, com controle total do visual editorial. Dá mais código no front. |
| 3 | Como a 2, com Recharts + Motion | Gráficos mais rápidos de fazer, mas entram dependências e um visual "de biblioteca", mais difícil de deixar no estilo editorial. |

**Escolhida: 2**, pelo usuário. Ela cobre tudo com dado real e mantém a simplicidade (sem dependências de runtime além do React). As mudanças no backend são quase todas rotas de leitura.

## 5. Identidade visual: "Editorial claro" (escolhida no mockup)

- **Clima:** papel creme, tinta quase preta e um único vermelho de destaque, com cara de livro didático ou revista.
- **Cores (tokens em `:root`):**
  - fundo `#f6f2ea`, superfície `#ffffff`, superfície-2 `#efe9dd`;
  - tinta `#16130f`, tinta suave `#5b5346`, borda `#d9cfbd`;
  - destaque `#e4472b`.
  - Estados: sucesso `#1f7a4a`, aviso `#a86a00`, perigo `#c8321f`.
  - Séries A/B/C em categóricas que funcionem sobre creme e entre si, revalidando as atuais `--serie-a/b/c`.
- **Ajuste para projetor:** o tema claro tende a lavar. Por isso: texto principal sempre em tinta (contraste ≥ 7:1 sobre creme), bordas de 1,5 px nítidas em vez de sombras suaves, e nada de informação essencial em tom pastel.
- **Tema escuro:** decisão minha. Um botão alterna para uma versão escura ("tinta sobre papel invertida"), útil se a sala estiver clara demais ou escura demais. O padrão é o claro.
- **Tipografia:**
  - **Fraunces** (serifa) em títulos e números grandes, como preço e KPIs;
  - **Inter** no texto, com `font-variant-numeric: tabular-nums` nas tabelas;
  - **JetBrains Mono** no JSON dos eventos e nos IDs.
  - As fontes são **empacotadas localmente** (`@fontsource-variable/*` ou arquivos `.woff2` em `public/`) para funcionar sem internet. Decisão minha; são só arquivos de fonte, não bibliotecas de UI.
- **Escala:** base de 18 px (maior que o usual, por causa do projetor); preço do palco por volta de 64 px; KPIs por volta de 40 px.
- **Movimento:** transições curtas (150–300 ms) para mudança de valor, mais "pulso" no preço e no evento novo. Todas respeitam `prefers-reduced-motion`.

## 6. Estrutura da tela

```
┌ topo: Leilão.  [Integridade][Desempenho][Rede][Auditoria][Arquitetura][E se fosse…?]   estou como ▾  ◐ ┐
├──────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ PALCO        │ ABA ATIVA                                                                            │
│ leilão em    │  pergunta-título ("Dois lances ao mesmo tempo: quem ganha?")                        │
│ foco ▾       │  controles → visualização viva → números                                            │
│ R$ 1.240     │  caixa "Por que funciona assim?" (liga a uma ADR)                                   │
│ líder · v37  │                                                                                      │
│ ⏱ 00:42      │                                                                                      │
│ [Dar lance]  │                                                                                      │
│ eventos…     │                                                                                      │
│ + novo · ver │                                                                                      │
└──────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Rotas por hash:** `#/{aba}` com o leilão em foco em `?leilao={id}`, por exemplo `#/auditoria?leilao=…`. Assim a mesma aba e o mesmo leilão abrem em duas janelas, o que permite mostrar o SSE chegando nas duas, e o botão "voltar" funciona. A aba padrão é Integridade.
- **Palco** (coluna esquerda, sempre visível):
  - seletor do leilão em foco;
  - título, status, preço atual em destaque (pulsa quando muda), líder, versão e contagem regressiva;
  - botão "Dar lance" com o próximo valor sugerido (editável) e "Cancelar", visível só para o vendedor e com confirmação;
  - os últimos 5 eventos chegando via SSE. *Decisão minha:* hoje o SSE envia só a foto do estado (`LeilaoDetalhe`), sem o tipo do evento. A mensagem SSE ganha o campo aditivo `evento: { tipo, versao }`. Isso é mudança de contrato: atualizar `contratos`/`types.ts` no mesmo PR. O medidor de rede passa a contar esses bytes, o que é correto, porque são os bytes reais.
  - "Ver todos" abre uma **gaveta** com a lista e o filtro por status (substitui a tela de lista).
  - "Novo leilão" abre uma gaveta com o formulário (substitui a tela de criar; só para o vendedor).
- **Topo:** abas, "estou como" e alternância de tema.
- **Cada aba** segue o mesmo esqueleto: pergunta, controles, visualização viva, números e a caixa "Por que funciona assim?".

## 7. As abas

Em cada aba, a coluna "Fonte" diz de onde vem o dado. **Real** quer dizer medido no sistema; **ilustração** quer dizer animação explicativa, sempre com selo.

### 7.1 Integridade: "Dois lances ao mesmo tempo: quem ganha?"
- **Rajada no leilão em foco:** N lances simultâneos (licitantes diferentes, mesmo valor ou valores próximos) disparados de uma vez.
  - **Visualização:** a "escada de versões", com cada lance como um ponto que tenta subir para a versão v+1. Um aceito e os demais recusados ou em conflito, coloridos.
  - **Fonte:** real, a partir das respostas do `POST /lances`: aceito com versão, 422 com código, 409 de conflito e, **decidido pelo usuário**, o número de **tentativas** que o serviço precisou. Hoje o `ServicoLeilao` retenta até 3 vezes quando perde a disputa pelo `UNIQUE(leilao_id, versao)`, e o navegador não vê a colisão. Com as tentativas expostas, a escada mostra de verdade quem colidiu e quantas vezes tentou de novo (ver item 5 da seção 8).
- **Simulação completa:** reaproveita `simulacao.ts`, com licitantes, lances, simultâneos, leitores e semente. O leilão criado pela simulação vira o leilão em foco, então o palco se mexe junto.
  - **Visualização:** raias por licitante ao longo do tempo, com cada lance colorido por resultado; progresso ao vivo.
  - **Fonte:** real.
- **Checagens (✓/✗ grandes):** um único vencedor, preço final igual ao maior lance aceito, e o histórico de lances batendo com os aceitos (as checagens existentes no `simulacao.ts`: `umVencedor`, `trilhaCompleta` e `ordem`). Some-se a elas uma checagem nova de **versões contíguas sem buraco**, feita sobre `GET /leiloes/{id}/eventos`. Fonte: real.
- **"Por que funciona assim?":** `UNIQUE(leilao_id, versao)` e `versaoEsperada` (ADR-002).

### 7.2 Desempenho: "O cache ajuda mesmo?"
- **Configuração ativa** (A/B/C) em destaque, lida da rota de configuração dos dois serviços (seção 8, item 6). Um aviso aparece se escrita e leitura discordarem.
- **Botão "Comparar A × B × C"** (decidido pelo usuário):
  - **Fluxo:** um clique roda a **mesma simulação** (mesmos parâmetros e semente) nas três configurações, **em sequência**, sem reiniciar nada. Para cada configuração, o front troca a configuração nas duas portas, confirma que as duas responderam com a nova, roda a simulação num leilão novo e espera a leitura assentar (`esperarLeituraAssentar`). No fim, volta à configuração que estava antes.
  - **Na tela:** as três colunas vão se preenchendo ao vivo, com a configuração da vez em destaque e o progresso de cada uma. Um aviso pede para não dar lances em outros leilões durante a comparação, porque eles cairiam na configuração da vez.
  - **Interrupção:** se o apresentador interromper ou algo falhar, o front também restaura a configuração anterior.
  - **Histórico:** as três execuções vão para o histórico (`historico.ts`) como uma **comparação** agrupada, e as anteriores continuam consultáveis.
- **Comparação A × B × C:** os gráficos abaixo usam a comparação mais recente, ou a escolhida no histórico. Fonte: real.
  - latência no navegador p50/p95/p99 (barras agrupadas);
  - tempo médio para obter o estado no backend;
  - eventos lidos por obtenção;
  - taxa de acerto do cache;
  - **de onde veio o estado** (barras empilhadas: Redis, checkpoint, início, fonte);
  - curva **tempo × tamanho do leilão**, evoluindo o `Grafico.tsx`.
- **Ao vivo:** sparkline de obtenções por segundo e tempo médio, lendo `/actuator/metrics` a cada 2 s enquanto a aba está aberta. Durante uma rajada ou simulação, a sala vê a curva reagir. Fonte: real.
- **"Por que funciona assim?":** ADR-003 (cópia versionada; fica incompleta, nunca errada).

### 7.3 Rede: "Quanto custa ficar ao vivo?"
- **Medidor de rede do front:** toda chamada passa por um `fetch` instrumentado que registra rota, método, status, duração e tamanho do corpo em bytes (lido no próprio wrapper). Cada mensagem SSE registra o tamanho dos dados.
  - **Limitação mostrada na tela:** medimos o corpo das respostas, sem os cabeçalhos HTTP. O navegador não informa o tamanho real em transferências entre origens sem o cabeçalho `Timing-Allow-Origin`.
  - **Fonte:** real.
- **Visualizações:**
  - requisições e bytes por rota (barras);
  - linha do tempo das requisições recentes (estilo "waterfall");
  - tamanho de cada tipo de resposta.
- **SSE × polling lado a lado:** com um clique, por 30 s, o front acompanha o leilão em foco de dois jeitos ao mesmo tempo: pelo SSE e por polling de `GET /leiloes/{id}` com intervalo ajustável (padrão 1 s).
  - **Medições:** requisições, bytes e **atraso até perceber o novo preço** em cada método (do aceite do lance até a chegada da notícia).
  - Os lances podem vir do palco, de uma rajada ou de outra janela. *Decisão minha:* o atraso só é medido para lances **enviados por esta janela**, porque só ela conhece o momento do aceite. Lances de outras janelas contam requisições e bytes, mas aparecem como "atraso não medido".
  - **Fonte:** real.
- **"Por que funciona assim?":** ADR-001 (SSE após a gravação do evento).

### 7.4 Auditoria: "Dá para voltar no tempo?"
- **Linha do tempo** de **todos** os eventos do leilão em foco (tipo, versão, horário), com o **JSON** de cada um ao clicar. Fonte: real, da rota nova `GET /leiloes/{id}/eventos`.
- **Viagem no tempo:** um slider de versão 1…atual reconstrói o estado naquela versão. Mostra o estado (preço, líder, status, fim) e o **que mudou** em relação à versão anterior.
  - **Fonte:** real, pela rota nova `GET /leiloes/{id}?ateVersao=N`, que usa o mesmo `aplicar` do módulo `estado`. O front **não** reimplementa regra.
- **Reconstruir cache:** um botão (com confirmação) chama a rota nova na escrita. A tela anima as 4 etapas com os números devolvidos:
  1. fotografia: N leilões;
  2. apagados: X chaves do Redis e Y checkpoints;
  3. refeitos N estados a partir dos eventos;
  4. idênticos ✓, ou a lista dos que estavam atrás.

  A tela mostra também o tempo de cada etapa. Fonte: real.
- **"Por que funciona assim?":** ADR-002 (eventos imutáveis, trigger append-only).

### 7.5 Arquitetura: "Por onde passa um lance?"
- **Diagrama vivo em SVG:** front → leilao-escrita → Event Store + outbox → Kafka → leilao-leitura / agendador → SSE → front.
  - Cada lance dado **por esta janela** acende o caminho em sequência.
  - **Tempos reais medidos:** clique → resposta do `POST` (gravação confirmada) e resposta → chegada do evento pelo SSE (outbox, Kafka, leitura e SSE juntos).
  - Os passos intermediários acendem em ordem, mas **não** recebem tempos próprios inventados.
  - Lances de outras janelas acendem só a parte de leitura.
- **Saúde dos serviços:** cartões para escrita, leitura, agendador, Postgres, Redis e Kafka (UP/DOWN e tempo de ida e volta medido no navegador), atualizados a cada 5 s. Fonte: real (ver item 4 da seção 8).
- **ADRs:** cartões das ADR-001 a 004 (decisão em uma frase), cada um levando à aba que o prova.

### 7.6 E se fosse…? "Por que não do jeito comum?"

Quatro comparações animadas com controles de play e passo, todas com o selo **ilustração**. Sempre que possível usam os **eventos reais** do leilão em foco como material:

- **CRUD × Event Sourcing:** os mesmos lances reais aplicados em uma "tabela" que sofre UPDATE (a história some) versus a lista de eventos que só cresce.
- **CQRS com banco de leitura × cache versionado:** linha do tempo mostrando a réplica atrasada exibindo um preço velho enquanto alguém dá lance sobre ele, versus a leitura usando a mesma versão.
- **REST síncrono × broker:** o agendador ou as notificações "caem" e, no síncrono, o lance falha junto; no broker, o lance passa e o consumidor alcança depois.
- **RabbitMQ × Kafka:** a mensagem consumida some da fila, versus o log retido por partição (chave = id do leilão), com um consumidor novo relendo.

## 8. Acréscimos no backend

1. **`GET /leiloes/{id}/eventos`** em `leilao-leitura`:
   - devolve `[{ versao, tipo, dados, criadoEm }]` em ordem de versão;
   - lê `event_store.eventos`, ao qual o `query_svc` já tem SELECT;
   - 404 se o leilão não existir.
2. **`GET /leiloes/{id}?ateVersao=N`** em `leilao-leitura`:
   - estado reconstruído a partir dos eventos `1..N` com o `aplicar` do módulo `estado`;
   - **não lê nem grava** cópia (Redis ou checkpoint) e não altera as métricas do `ObterEstado` usadas no Desempenho;
   - 400 se N for menor que 1 ou maior que a versão atual.
3. **`POST /admin/cache/reconstruir`** em `leilao-escrita`:
   - extrai a lógica do `ReconstrutorCache` para uma classe reutilizável (no módulo `estado` ou na escrita). A ferramenta CLI passa a chamá-la;
   - responde com as etapas: `{ leiloes, chavesApagadas, checkpointsApagados, refeitos, diferentes: [ids], tempos: {fotografia, apagar, refazer, comparar} }`;
   - fica na escrita porque o `command_svc` pode apagar e gravar checkpoints, e o `query_svc` não;
   - CORS para 5173.
4. **Saúde** *(decisão minha)*:
   - o `/actuator/health` principal de cada serviço continua como está;
   - o `management.health.redis.enabled: false` é **mantido**, porque o Redis cair não pode derrubar o serviço (ADR-003);
   - as dependências ganham uma **checagem separada** em `leilao-leitura`, que já conecta nas três: `GET /infra/saude` devolve Postgres, Redis e Kafka (este por `AdminClient.describeCluster` com timeout curto), cada um com status e tempo. *Ajuste no plano:* foi usada uma rota própria em vez de um grupo do actuator, porque o `/actuator/health` raiz agrega todos os indicadores registrados, e um indicador de Redis voltaria a marcar o serviço como DOWN;
   - CORS do actuator no agendador (8084), para o cartão dele;
   - o tempo mostrado é o de ida e volta medido no navegador.

5. **Tentativas no lance** (decidido pelo usuário):
   - `POST /leiloes/{id}/lances` passa a informar quantas tentativas o `ServicoLeilao` fez, tanto no sucesso (`{ versao, tentativas }`) quanto no 422 (campo `tentativas` no corpo de erro);
   - no 409 (todas as tentativas falharam), `tentativas` = o máximo (3);
   - é mudança aditiva de contrato: `contratos` e `types.ts` no mesmo PR;
   - teste de integração: dois lances na mesma versão, um com `tentativas = 1` e o outro com `tentativas ≥ 2`.

6. **Configuração A/B/C trocável em tempo de execução** (decidido pelo usuário, abordagem "troca global, em sequência"):
   - `GET /admin/cache/configuracao` e `PUT /admin/cache/configuracao` (corpo `{ "configuracao": "A"|"B"|"C" }`) **na escrita e na leitura**, com CORS para 5173. O PUT devolve a configuração já em vigor;
   - `Configuracao` deixa de ser lida uma única vez no construtor de `CacheEstadoLeilao` e `Checkpoint`, que hoje guardam um `ligado` fixo. Passa a ser um estado compartilhado do módulo `estado` (por exemplo, um bean `ConfiguracaoAtiva` com valor atômico), consultado a cada operação. O valor inicial continua vindo de `leilao.cache.configuracao`;
   - **métricas:** hoje a tag `configuracao` é fixa (`management.metrics.tags.configuracao`). Ela passa a ser a configuração **do momento da medição**, e a tag global fixa sai. O `metricas.ts` e o `lerConfiguracao` do front passam a ler a configuração pela rota nova, e as fotos de antes e depois são filtradas pela tag da configuração da vez;
   - **correção não muda:** a troca não altera regra nenhuma. Uma cópia desligada se comporta como vazia, e uma cópia antiga deixada no Redis por outra configuração é só uma cópia atrasada, que é completada pelos eventos (ADR-003). Cada execução da comparação usa um leilão novo, então sobras de uma configuração não afetam a seguinte;
   - testes: trocar a configuração e verificar que a obtenção do estado segue a nova (por exemplo, em A, eventos lidos = versão), e que o estado obtido é igual nas três.

Corpos novos de resposta entram no espelho `types.ts` se ficarem em `contratos`. Testes de integração para as rotas 1 a 3.

## 9. O que muda no front (código)

- **Reescrita do visual e do layout** (`index.css` novo, a partir dos tokens da seção 5) e do `App.tsx` (shell, palco e abas).
- **Telas atuais:**
  - `ListaLeiloes`, `CriarLeilao` e `DetalheLeilao` viram as gavetas e o palco;
  - `PainelAdm` se divide entre as abas Integridade e Desempenho.
- **Lógica reaproveitada sem reescrever regra:** `simulacao.ts`, `metricas.ts`, `historico.ts`, `api.ts` (ganha o wrapper de rede e as rotas novas) e `formato.ts`.
- **Gráficos:** componentes SVG próprios e pequenos (barras, barras empilhadas, linhas, sparkline e raias), sem biblioteca. Usar o skill de dataviz do projeto como referência de cores e marcas.
- **Testes:** hoje não há testes no front (o `PAINEL_ADM.md` cita `test/simulacao.test.ts`, que não existe). Proposta minha: adicionar Vitest como dependência de desenvolvimento e cobrir a lógica pura (percentis, checagens, medidor de rede, cálculo de atraso SSE × polling e diferença entre versões).

## 10. Decisões do usuário após a revisão

- **Troca A/B/C sem reiniciar: sim, em sequência.** Um botão roda a mesma simulação em A, B e C, trocando a configuração em tempo de execução nos dois serviços (seções 7.2 e 8, item 6). A alternativa de rodar as três em paralelo, com configuração por leilão, foi descartada: as três disputariam CPU, banco e Redis, contaminando a comparação, e a marca de configuração teria de viajar com os eventos pelo Kafka.
- **Tentativas expostas no lance: sim** (seção 8, item 5).

## 11. Deixado para quem construir

- A forma exata de cada gráfico e animação, dentro da identidade da seção 5.
- Nomes de componentes e arquivos.
- Valores padrão de rajada, polling e intervalos, desde que configuráveis na tela.
- A organização interna dos novos acréscimos no backend, desde que respeitem as regras do README.
