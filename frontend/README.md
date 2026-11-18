# Frontend

Vite + React + TypeScript. A infra e a documentação estão na raiz: veja o [README principal](../README.md).

Interface pensada para apresentar a arquitetura em sala: um **palco** com o leilão ao vivo (lances, lista de leilões, criar leilão) e seis abas que respondem a uma pergunta cada.

```bash
cp .env.example .env
npm install
npm run dev      # http://localhost:5173
npm test         # Vitest (testes de unidade)
npm run lint     # oxlint
npm run build    # tsc + vite build
```

## Abas

| Aba | Pergunta | O que mostra |
|---|---|---|
| Integridade | Dois lances ao mesmo tempo: quem ganha? | Rajada de lances e simulação completa (aceitos, recusados, conflitos, um só vencedor, trilha completa) |
| Desempenho | O cache ajuda mesmo? | Métricas ao vivo e o botão "Comparar A × B × C": troca a configuração do cache em execução, roda a mesma simulação em cada uma e volta à configuração anterior |
| Rede | Quanto custa ficar ao vivo? | Experimento SSE × polling, com waterfall das requisições |
| Auditoria | Dá para voltar no tempo? | Linha do tempo dos eventos, slider de versão (`?ateVersao=N`) e reconstrução do cache a partir dos eventos |
| Arquitetura | Por onde passa um lance? | Diagrama com um lance acompanhado, saúde de Postgres/Redis/Kafka e dos serviços, ADRs |
| E se fosse…? | Por que não do jeito comum? | Quatro cenários comparando CRUD, CQRS e o desenho atual |

## Rotas

Navegação pelo hash, sem biblioteca: `#/{aba}?leilao={id}` (abas: `integridade`, `desempenho`, `rede`, `auditoria`, `arquitetura`, `e-se-fosse`). Sem aba, abre `integridade`. A rota antiga `#/leilao/{id}` continua valendo. O leilão fica na URL, então dá para abrir o mesmo leilão em duas janelas.

O antigo Painel ADM (`#/adm`) foi removido: a simulação está em Integridade e a comparação A × B × C em Desempenho (veja [docs/PAINEL_ADM.md](../docs/PAINEL_ADM.md)).

## Tema e fontes
- Tema claro (padrão) ou escuro, pelo botão no topo; a escolha fica no `localStorage` (`tema`).
- As fontes (Fraunces, Inter e JetBrains Mono) vêm empacotadas pelo `@fontsource-variable/*`: funcionam sem internet.
- As animações respeitam `prefers-reduced-motion`.

## Variáveis
- `VITE_COMMAND_API`: API de comandos (padrão `http://localhost:8081`)
- `VITE_QUERY_API`: API de consulta (padrão `http://localhost:8082`)
- `VITE_SCHEDULER_API`: agendador, só para o indicador de saúde (padrão `http://localhost:8084`)

`src/types.ts` espelha os corpos HTTP de `backend/contratos`: mudou um, muda o outro no mesmo PR.
