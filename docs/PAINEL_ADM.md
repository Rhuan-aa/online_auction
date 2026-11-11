# Plano — Painel de ADM (simulação e desempenho)

> Status: **planejado, implementação pausada.** Branch `d/painel-adm`. Rascunho já criado: `frontend/src/api.ts`.

## 1. Objetivo

Uma única tela de administração para **demonstrar a arquitetura**, não o "dar lance". O ADM configura uma simulação de leilão, o painel dispara lances aleatórios e mostra, medido de verdade:

- **Integridade:** um único vencedor e nenhum lance aceito perdido.
- **Desempenho:** latência da escrita e da leitura, **com CQRS × sem CQRS**.
- **Consistência eventual:** quanto tempo a leitura leva para alcançar a escrita.

Não existem telas de usuário (lista, detalhe ou botão de lance).

## 2. A tela

```
┌─ SIMULAÇÃO ────────────────────────────────────────────────────────────┐
│ Licitantes [20]  Lances por licitante [10]  Lances simultâneos [6]     │
│ Preço inicial [R$ 100]  Incremento aleatório [R$ 1 a R$ 50]            │
│ Leitores (consultas simultâneas) [10]  Semente [42]     [▶ Executar]   │
├─ RESULTADO ────────────────────────────────────────────────────────────┤
│ INTEGRIDADE   aceitos · recusados · conflitos | 1 vencedor ✓ | trilha ✓│
│ ESCRITA       p50 · p95 · lances/s                                     │
│ LEITURA       com CQRS p95  ×  sem CQRS p95  (N× mais lento)           │
│ CONSISTÊNCIA  a leitura alcançou a escrita em X ms                     │
│ GRÁFICO       tempo da consulta × nº de eventos (duas linhas)          │
├─ HISTÓRICO ────────────────────────────────────────────────────────────┤
│ execuções anteriores, para comparar                                    │
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
| Semente | Mesma semente = mesma simulação (para ensaiar a apresentação) |

### Como cada execução funciona
1. `POST /leiloes` com início = agora e fim = agora + 10 min (longe do anti-sniping).
2. Espera o status `ABERTO` (o agendador abre o leilão). Sem isso em 15 s, mostra "o agendador está rodando?".
3. Dispara os lances com o número de simultâneos escolhido, mantendo a ordem de cada licitante.
4. Em paralelo, os leitores alternam consulta **com CQRS** e **sem CQRS**, guardando (tempo, nº de eventos).
5. Ao fim, consulta a leitura até ela mostrar a versão do último lance aceito → **atraso da consistência eventual**.
6. Checagens:
   - **Um vencedor:** líder e preço finais = autor e valor do último lance aceito.
   - **Trilha completa:** nº de lances em `GET /leiloes/{id}/lances` = nº de respostas `200`.
   - **Ordem:** versões e valores do histórico estritamente crescentes.

## 3. Com CQRS × sem CQRS (medição real)

| | Como consulta | Comportamento esperado |
|---|---|---|
| **Com CQRS** | `GET leilao-leitura/leiloes/{id}`: uma linha de `catalogo_leiloes` | Tempo **constante** |
| **Sem CQRS** | `GET leilao-escrita/experimento/sem-cqrs/leiloes/{id}`: carrega todos os eventos e reconstitui o estado | Tempo **cresce** com o nº de eventos |

É exatamente a alternativa descrita no ADR-003 ("Event Sourcing sem CQRS obrigaria a reconstruir agregados a cada consulta"). **Nenhum número é inventado.**

## 4. Mudanças no backend (mínimas)

Só o que o painel precisa além do que o PLANO.md já prevê:

| Onde | O quê |
|---|---|
| `leilao-escrita/api` | `GET /experimento/sem-cqrs/leiloes/{id}`: chama `eventStore.carregar(id)` + `Leilao.reconstituir(eventos)` e devolve o mesmo JSON de `GET /leiloes/{id}`. ~15 linhas, reaproveita código que já vai existir. |
| `leilao-escrita` e `leilao-leitura` | CORS liberado para `http://localhost:5173` (já previsto no PLANO.md). |

Rotas usadas (todas já no PLANO.md): `POST /leiloes`, `POST /leiloes/{id}/lances`, `GET /leiloes/{id}`, `GET /leiloes/{id}/lances`. O SSE **não** é necessário para o painel.

A rota de experimento é isolada e serve só para a comparação; ela não fere a regra "a leitura nunca chama a escrita".

## 5. Frontend (o mais simples possível)

Sem bibliotecas novas. React puro, CSS próprio, gráfico em SVG. Uma página.

| Arquivo | Conteúdo | Status |
|---|---|---|
| `src/api.ts` | Interface `Api` com duas implementações: **real** (fetch 8081/8082) e **simulada** (em memória: versão otimista, conflitos, projeção atrasada, leitura sem CQRS que relê os eventos) | ✅ rascunho pronto (compila) |
| `src/simulacao.ts` | Gera os lances com semente, executa com N simultâneos, roda os leitores, calcula p50/p95 e as checagens | a fazer |
| `src/App.tsx` | Formulário, resultado, gráfico e histórico | a fazer |
| `src/index.css` | Estilo | a fazer |

Modo escolhido por variável em `frontend/.env`:
```
VITE_MODO=simulado   # padrão: testa a tela sem backend (mostra o selo "MODO SIMULADO")
VITE_MODO=real       # usa o backend de verdade
```
**Na apresentação, só o modo real.** No simulado os tempos são artificiais: servem para desenvolver a tela, não provam nada.

## 6. O que sai do plano original

- Telas de usuário (lista, detalhe, criar leilão, botão de lance).
- `SimuladorLances` do módulo `ferramentas`: o painel faz esse papel.

## 7. Limites (dizer se a banca perguntar)

- Os tempos são medidos **no navegador** e incluem a rede local; a comparação é justa porque os dois lados passam pelo mesmo caminho.
- O navegador abre ~6 conexões por porta. Basta para gerar conflitos reais em demo, mas não é teste de carga de produção.
- As consultas sem CQRS vão para a mesma porta dos lances (8081) e disputam conexões com eles. Isso também mostra o custo de ler pelo lado da escrita.

## 8. Próximos passos

1. Testar o sistema atual (infra + serviços + build).
2. Retomar: `simulacao.ts`, `App.tsx`, `index.css` no modo simulado.
3. Quando A/B/C entregarem as rotas: implementar a rota de experimento e trocar para `VITE_MODO=real`.
