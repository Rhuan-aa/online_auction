# Frontend

Vite + React + TypeScript. A infra e a documentação estão na raiz: veja o [README principal](../README.md).

Uma página só, sem abas: a **corrida de arquiteturas**. O mesmo leilão roda ao mesmo tempo em 6 arquiteturas
(CRUD simples, CRUD + cache, Event Sourcing puro, ES + snapshot, ES + cache e ES + CQRS) no serviço
`leilao-corrida` (8085), e a página mostra tudo o que foi medido. Desenho: `docs/superpowers/specs/2026-11-19-corrida-arquiteturas-design.md`;
contrato: `docs/superpowers/specs/2026-11-19-corrida-contrato.md`.

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest (testes de unidade)
npm run lint     # oxlint
npm run build    # tsc + vite build
```

## A página, de cima para baixo

1. **Simulação**: 6 campos (licitantes, lances por licitante, lances simultâneos, leitores, preço inicial, incremento), sem limite máximo, cada um com um tooltip. ▶ Iniciar corrida / ■ Parar.
2. **Corrida ao vivo**: uma raia por arquitetura, atualizada pelo SSE `GET /corrida/{id}/stream` (eventos `foto` e `fim`).
3. **Comparação**: gráficos SVG próprios (`src/graficos/`), uma cor por arquitetura (`--arq-1…6`).
4. **Placar**: o melhor de cada critério destacado, integridade e histórico. Selo "medido nesta máquina; as 6 rodaram juntas e disputaram CPU e banco".
5. **Por onde passa um lance?**: um lance real no sistema (8081 → Kafka → 8082 → SSE), num leilão aberto escolhido ou criado na hora.
6. **Dá para voltar no tempo?**: linha do tempo dos eventos e o estado em qualquer versão, no mesmo leilão.

O leilão das seções 5 e 6 fica no hash (`#?leilao={id}`).

## Código

- `src/corrida/`: tipos do contrato, `useCorrida` (POST, SSE e parar), formulário, raias, gráficos, placar e as funções puras (`formulario.ts`, `medidas.ts`, `series.ts`, `melhores.ts`).
- `src/caminho/`, `src/tempo/`: as seções 5 e 6; `src/leilao/`: o leilão real (`useLeilao`, seletor, regras).
- `src/estilo/tokens.css`: cores e medidas dos dois temas (palco e claro).

## Tema e fontes
- Tema palco (padrão, índigo) ou claro, pelo botão no topo; a escolha fica no `localStorage`.
- Plus Jakarta Sans e JetBrains Mono vêm empacotadas pelo `@fontsource-variable/*`: funcionam sem internet.
- As animações respeitam `prefers-reduced-motion`.

## Variáveis
- `VITE_COMMAND_API`: API de comandos (padrão `http://localhost:8081`)
- `VITE_QUERY_API`: API de consulta (padrão `http://localhost:8082`)
- `VITE_CORRIDA_API`: laboratório da corrida (padrão `http://localhost:8085`)

`src/types.ts` espelha os corpos HTTP de `backend/contratos` e `src/corrida/tipos.ts` o contrato da corrida: mudou um, muda o outro no mesmo PR.
