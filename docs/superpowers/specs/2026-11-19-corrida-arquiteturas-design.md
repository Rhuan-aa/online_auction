# Design: corrida de arquiteturas (tela única)

Data: 19/11/2026. Status: pedido do usuário, com implementação autorizada. Substitui os adendos de front anteriores: modo apresentação em slides e abas. O backend de leilão atual (escrita, leitura, agendador) continua como está.

## Intenção

O front recomeça do zero com **uma tela só, sem abas**. As cores e a estrutura visual do modo apresentação continuam: índigo em gradiente, amarelo de destaque, Plus Jakarta Sans e JetBrains Mono, cartões translúcidos e botões em pílula, com os tokens atuais de `tokens.css`.

O centro da tela é uma **corrida ao vivo**. O mesmo leilão roda ao mesmo tempo em 6 arquiteturas, todas partindo do mesmo estado e com a mesma sequência de lances, e a tela mostra todas as diferenças medidas. Abaixo da corrida ficam duas seções que já existem hoje: **"Por onde passa um lance?"** e **"Dá para voltar no tempo?"**. Todo o resto do front é removido.

## As 6 arquiteturas (todas implementadas de verdade)

| id | Nome na tela | Como grava um lance | Como lê o estado | Auditoria e viagem no tempo |
|---|---|---|---|---|
| `crud` | CRUD simples | Lê a linha, valida e faz `UPDATE leilao SET preco, lider`, **sem controle de concorrência**. Essa ausência é proposital: ensina o problema. | `SELECT` da linha | Não suporta |
| `crud-cache` | CRUD + cache | `UPDATE … WHERE versao = ?` (otimista) e invalida ou grava no Redis | Redis (cache-aside); se faltar, banco | Não suporta |
| `es` | Event Sourcing puro | Relê todos os eventos, decide e faz `INSERT` do evento com `UNIQUE(leilao, versao)`. Em conflito, tenta de novo. | Relê todos os eventos | Suporta |
| `es-snapshot` | ES + snapshot | Igual a `es`, mas parte do snapshot gravado a cada N = 50 eventos | Snapshot mais os eventos posteriores | Suporta |
| `es-cache` | ES + cache | Igual a `es`, mas parte da cópia no Redis (versionada) mais os eventos posteriores. É a arquitetura do sistema. | Cópia no Redis | Suporta |
| `es-cqrs` | ES + CQRS | Igual a `es`, mais publicação no Kafka (tópico próprio) | Banco de leitura alimentado por um consumidor Kafka (projeção) | Suporta (pela escrita) |

A regra do lance é a mesma em todas: aceito se `valor ≥ preçoAtual + incremento` (no primeiro lance, `preçoInicial + incremento`), num leilão aberto. A regra fica em uma função pura compartilhada, testada uma vez. Não há prorrogação nem encerramento na corrida.

## Serviço de laboratório `leilao-corrida`

- **Onde roda:** novo módulo Maven `backend/leilao-corrida`, porta **8085**, com CORS para `http://localhost:5173`.
- **Dependências:** `contratos`, se for útil, e Spring Boot (web, jdbc, data-redis, kafka). Não depende de `leilao-escrita` nem de `leilao-leitura`.
- **Isolamento:** cada arquitetura tem seu próprio schema ou tabelas no Postgres (`corrida_crud`, `corrida_es`…), seu prefixo no Redis (`corrida:<id>:`), seu tópico Kafka (só `es-cqrs`: `corrida.cqrs`, criado pela aplicação com `NewTopic`) e seu pool de threads.
- **Banco:** o schema é criado pela própria aplicação na subida, com `CREATE … IF NOT EXISTS`. O laboratório usa o usuário `postgres` (só local) e por isso documenta isso.
- **Mesmo ponto de partida:** cada corrida cria o mesmo leilão inicial (mesmo id, preço e incremento) em todas as arquiteturas. A sequência de lances é gerada pela mesma semente, com o gerador mulberry32 de `simulacao.ts` portado. As 6 rodam **em paralelo**.
- **Carga gerada no servidor**, sem limite nos campos:
  - por arquitetura, `simultaneos` threads enviam os lances planejados (cada licitante faz `lancesPorLicitante` lances);
  - `leitores` threads consultam o estado sem parar enquanto houver lances;
  - o lance "acompanha o preço": o valor enviado é `max(valor planejado, último preço conhecido + passo sorteado)`.
- **API:**
  - `POST /corrida` com `{licitantes, lancesPorLicitante, simultaneos, leitores, precoInicial, incremento}` (dinheiro em centavos) → `{corridaId}`. Só uma corrida por vez; uma segunda recebe 409.
  - `GET /corrida/{id}/stream` (SSE): uma foto das 6 arquiteturas a cada 250 ms, e um evento `fim` com o resultado final.
  - `POST /corrida/{id}/parar` interrompe a corrida.
  - `GET /corrida/{id}` devolve o último estado.

## O que é medido, por arquitetura (e como aparece na tela)

| Métrica | Nome na tela | Definição |
|---|---|---|
| Latência de escrita | **Tempo para registrar um lance**, com "típico" (mediana) e "pior caso" (p95) | Do envio até a confirmação, medido no servidor, em ms |
| Curva | **Tempo × tamanho do leilão** | Tempo médio para registrar um lance por faixa de versão |
| Latência de leitura | **Tempo para consultar o preço** (típico e pior caso) | Duração de cada consulta |
| Atraso de leitura | **Leituras desatualizadas** | % das consultas que viram uma versão menor que a última confirmada, e o atraso médio em versões e em ms. Importa sobretudo no CQRS. |
| Vazão | **Lances por segundo** | Lances processados ÷ tempo decorrido |
| Concorrência | **Conflitos e retentativas** | Quantas vezes o lance perdeu a disputa e tentou de novo |
| Integridade | **Resultado correto?** | Exatamente um vencedor, preço final igual ao maior lance aceito, e nenhum lance aceito "perdido". No CRUD simples, lance aceito e depois sobrescrito por outro menor ou concorrente conta como perdido. |
| Custo | **Operações por lance** | Leituras e escritas no banco e operações no Redis por lance (contadores na implementação) |
| Espaço | **Espaço usado** | Linhas, eventos e chaves ao final (`COUNT`, `pg_total_relation_size` das tabelas da arquitetura) |
| Auditoria | **Histórico e viagem no tempo** | Suporta ou não; quando suporta, o número de eventos guardados |

Ao final aparece um **placar**: as arquiteturas lado a lado, com o vencedor de cada critério destacado. O selo "medido nesta máquina; as 6 rodaram juntas e disputaram CPU e banco" é obrigatório e fica sempre visível.

## Tela única (de cima para baixo)

1. **Topo:** marca "leilão●", o subtítulo "Corrida de arquiteturas" e o botão de tema.
2. **Simulação:** 6 campos (Licitantes, Lances por licitante, Lances simultâneos, Leitores, Preço inicial (R$), Incremento (R$)), sem limite máximo, só validando que são inteiros positivos e valores em dinheiro válidos.
   - Cada campo tem um **tooltip pequeno ao passar o mouse e ao focar** (acessível por teclado), explicando o que faz em uma frase.
   - O botão é **▶ Iniciar corrida**; durante a corrida, **■ Parar**.
3. **Corrida ao vivo:** 6 raias, uma por arquitetura. Cada raia mostra:
   - nome e uma linha do que a arquitetura faz;
   - barra de progresso dos lances;
   - tempo típico para registrar um lance;
   - lances por segundo;
   - conflitos;
   - leituras desatualizadas;
   - status: "rodando", "terminou em X s" ou "erro".

   Os números se atualizam em tempo real.
4. **Comparação:** os gráficos com a biblioteca SVG atual (`src/graficos/`):
   - tempo para registrar (típico e pior caso, barras agrupadas por arquitetura);
   - tempo para consultar;
   - lances por segundo;
   - tempo × tamanho do leilão (linhas, uma por arquitetura);
   - operações por lance;
   - espaço usado;
   - leituras desatualizadas.
5. **Placar:** a tabela final com ✓/✗ de integridade, auditoria e o vencedor de cada critério.
6. **"Por onde passa um lance?"** reaproveita o diagrama e a medição real atuais (`abas/arquitetura/Diagrama.tsx`, `caminho.ts`, `tentativa.ts`). Usa o sistema real (8081/8082) com um leilão aberto: um seletor dos leilões abertos e o botão "Criar leilão de demonstração".
7. **"Dá para voltar no tempo?"** reaproveita `LinhaDoTempo` e `ViagemNoTempo` com o mesmo leilão do item 6.

## Removido

Do front saem: as abas, os slides e sua navegação, as seções Integridade, Desempenho, Rede, "E se fosse…?", reconstruir cache e saúde dos serviços, o cartão flutuante e as gavetas do palco, o medidor de rede e o painel de comparação A/B/C (`comparacao.ts`, `historico.ts`, `metricas.ts` e `simulacao.ts`, se não forem mais usados). O código morto e os testes deles também saem. O backend existente não muda.

## Restrições

- Nenhuma biblioteca de runtime no front além de react e react-dom (mais as fontes).
- Cores só por tokens.
- Todo número exibido é medido; não há número inventado.
- O laboratório nunca escreve nas tabelas do sistema real (`event_store`, `checkpoint`) nem nas chaves `leilao:*` do Redis.
