# Adendo: front em "modo apresentação" (direção B)

Data: 19/11/2026. Status: escolhido pelo usuário no mockup. Substitui as seções 5 (identidade visual) e 6 (estrutura da tela) do design `2026-11-18-front-apresentacao-design.md`. Todo o resto continua valendo: o conteúdo de cada aba (seção 7), os acréscimos do backend (seção 8), "todo número é real" e o selo "ilustração".

## Por que mudou

O usuário não gostou do estilo editorial claro, nem do layout com palco fixo à esquerda e abas que rolam. Ele escolheu a direção B: **cada aba vira uma sequência de slides em tela cheia**. Cada slide tem uma pergunta grande, o botão que prova a resposta e o resultado visual ao lado. O leilão ao vivo fica num cartão flutuante.

## Identidade visual

- **Clima:** palco de apresentação, com fundo índigo em gradiente, texto branco e um amarelo de destaque. Lembra keynote, não dashboard.
- **Tokens do tema principal ("palco", o padrão):**
  - fundo: gradiente `#1b1f5e → #2b2f86 → #3b2f8f`, a 135°.
  - superfície: `rgb(255 255 255 / .08)`, com borda `rgb(255 255 255 / .18)`.
  - superfície-2: `rgb(255 255 255 / .14)`.
  - tinta: `#ffffff`; tinta suave: `rgb(255 255 255 / .72)`.
  - destaque: `#ffd23f`, com texto sobre ele `#1b1f5e`.
  - sucesso `#3ee6a8`, aviso `#ffb84d`, perigo `#ff6b8a`.
  - séries A/B/C: `#7cc4ff`, `#ffb84d`, `#3ee6a8`.
  - origens (redis, checkpoint, início, fonte): `#c4a7ff`, `#ff9ecb`, `rgb(255 255 255 / .55)`, `#ffd23f`.
  - Grade e eixo dos gráficos em branco translúcido.
- **Tema claro (alternativa para sala muito iluminada):**
  - fundo `#f4f5ff`, superfície `#ffffff`, tinta `#1b1f5e`;
  - destaque `#6a4cff` com texto branco;
  - as mesmas cores de estado, escurecidas o bastante para dar contraste ≥ 4,5:1 sobre branco.
  - O botão de tema continua no topo.
- **Tipografia:**
  - **Plus Jakarta Sans** (`@fontsource-variable/plus-jakarta-sans`, local) em títulos e texto, com títulos em peso 800;
  - **JetBrains Mono** em números, JSON e IDs;
  - sai a Fraunces.
- **Escala de títulos:** título do slide 40–48 px, kicker ("PERGUNTA 1 · PASSO 2/4") com 12 px de espaçamento entre letras, texto 18 px.
- **Formas:** cantos de 18 px nos cartões e botões em pílula (`border-radius: 999px`). O botão primário é amarelo com texto índigo.
- **Movimento:** transição de slide curta (fade/deslize de 200 ms). Sem animação com `prefers-reduced-motion`.

## Estrutura

```
┌ leilão●   ▬▬ ▬▬ ▬▬ ▬▬ ▬▬ ▬▬ (6 seções, clicáveis)   2 / 6 · Desempenho   estou como ▾  ◐ ┐
│                                                                                          │
│  PERGUNTA 2 · PASSO 1/4                     ┌──────────────── palco visual ────────────┐ │
│  O cache ajuda mesmo?                       │  (gráfico, escada, diagrama, colunas…)   │ │
│  texto curto que explica o que vai          │                                          │ │
│  acontecer quando apertar o botão           │                                          │ │
│  [▶ Comparar A × B × C]                     └──────────────────────────────────────────┘ │
│                                                                                          │
│  ( ← )( → )   ● ● ○ ○  (passos da seção)                     ┌ ao vivo  R$ 1.350  ┐       │
│                                                              │ licitante-1 · v9 · 00:42 │ │
└──────────────────────────────────────────────────────────────└──────────────────────────┘ ┘
```

- **Barra superior:**
  - marca "leilão●", com o ponto amarelo;
  - 6 segmentos de progresso, um por seção, clicáveis, com a seção atual em amarelo;
  - o texto "n / 6 · Nome";
  - à direita, "estou como" e o botão de tema.
- **Área do slide:** ocupa a altura da janela. Em 1366×768 cada slide deve caber sem rolar a página; se o conteúdo for maior, ele rola dentro do slide. Há dois layouts:
  - **Dividido** (padrão): à esquerda o texto (kicker, título, explicação, ação) e à direita o "palco visual", num cartão translúcido.
  - **Largo:** título no topo e o visual ocupando toda a largura. Serve para gráficos em grade, o diagrama e a linha do tempo.
- **Navegação:**
  - botões ← → no canto inferior esquerdo e bolinhas dos passos da seção;
  - teclado: ←/→ e PageUp/PageDown, ignorados quando o foco está num campo de texto, select ou slider;
  - o → no último passo de uma seção vai para o primeiro passo da próxima, e o ← faz o inverso.
- **Rotas:** `#/{aba}/{passo}?leilao={id}`, com passo a partir de 1. Sem passo, vale 1.
  - `#/{aba}?leilao=` e `#/leilao/{id}` continuam funcionando.
  - Passo inválido cai no 1.
- **Leilão ao vivo:** sai a coluna fixa. Fica um **cartão flutuante** no canto inferior direito, com "ao vivo", preço grande, líder · versão e contagem regressiva.
  - Clicar no cartão expande um painel com o palco completo: título, status, lance com valor editável, cancelar (só para o vendedor), últimos eventos, "trocar leilão" e "novo leilão".
  - As gavetas de lista e criação continuam como estão.
  - As situações "desatualizado", "indisponível" e "não encontrado" aparecem no cartão.
- **"Por que funciona assim?"** vira o **último passo** de cada seção. O slide é largo, com o texto em destaque e a ADR citada.

## Passos de cada seção

O conteúdo e a lógica de hoje são reaproveitados; só a disposição muda.

1. **Integridade**
   1. Rajada: controles à esquerda; escada de versões e KPIs no palco visual.
   2. Simulação completa: formulário à esquerda; raias e checagens no palco.
   3. Por que funciona.
2. **Desempenho**
   1. Comparar A×B×C: configuração ativa, formulário e botão à esquerda; as 3 colunas ao vivo no palco.
   2. Resultado: percentis da escrita e da leitura (largo).
   3. Por dentro do cache: tempo médio no backend, eventos lidos, acerto e origem do estado (largo).
   4. Tempo × versão, histórico e ao vivo (largo).
   5. Por que funciona.
3. **Rede**
   1. Custo por rota: gráfico e tabela.
   2. As últimas 30 requisições (largo).
   3. Experimento SSE × polling.
   4. Por que funciona.
4. **Auditoria**
   1. Linha do tempo com o JSON dos eventos.
   2. Viagem no tempo.
   3. Reconstruir o cache.
   4. Por que funciona.
5. **Arquitetura**
   1. Caminho de um lance: o diagrama, largo, com o botão "Dar lance e acompanhar".
   2. Saúde dos serviços.
   3. Decisões (ADRs).
6. **E se fosse…?**
   1. CRUD × Event Sourcing.
   2. CQRS × cache.
   3. REST síncrono × broker.
   4. RabbitMQ × Kafka.
   5. Por que (resumo).

   Cada cartão vira um slide dividido: a legenda e os controles do cenário à esquerda, "Nosso sistema | Alternativa" no palco visual.

## Restrições que continuam valendo

- Nenhuma biblioteca de runtime além de react, react-dom e as fontes.
- Cores só por tokens, nos dois temas.
- O estado de cada aba sobrevive à troca de passo dentro da seção. Por exemplo, o resultado da rajada continua lá ao voltar do passo 2 para o 1. Monte a seção inteira e mostre só o passo ativo, ou suba o estado. Não desmonte a seção a cada passo.
- Processos longos (comparação, experimento, simulação) não são interrompidos por trocar de passo dentro da mesma seção. Trocar de seção pode interromper, como hoje.
- `usePalco` continua sendo chamado uma única vez, no App.
- Os testes existentes continuam verdes. Adicionar testes para a navegação (próximo e anterior entre seções, leitura da rota com passo).
