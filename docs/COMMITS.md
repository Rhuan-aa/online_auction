# Como fazer commits

Usamos [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/):

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final>

[corpo opcional: o porquê da mudança]

[rodapé opcional: BREAKING CHANGE: ..., Refs #12]
```

## Tipos

| Tipo | Quando usar |
|---|---|
| `feat` | Funcionalidade nova |
| `fix` | Correção de bug |
| `test` | Testes novos ou ajustados |
| `refactor` | Mudança de código sem mudar o comportamento |
| `docs` | Documentação (README, ADR, C4, slides) |
| `build` | Maven, npm, dependências, Dockerfile |
| `ci` | GitHub Actions |
| `chore` | Manutenção que não entra nos tipos acima |
| `perf` | Melhoria de desempenho |
| `style` | Formatação, sem mudar a lógica |

## Escopos

Use o nome do módulo ou da pasta: `escrita`, `leitura`, `agendador`, `ferramentas`, `contratos`, `frontend`, `infra`, `adr`, `c4`.

## Exemplos

```
feat(escrita): rejeita lance menor que o atual mais o incremento
fix(leitura): ignora evento repetido com versão já aplicada
test(escrita): cobre a extensão do prazo por anti-sniping
feat(contratos)!: renomeia amount para amountCents em BidPlaced.v1
docs(adr): adiciona ADR-004 sobre Kafka x RabbitMQ
build(infra): limita a memória do Kafka no compose
```

## Regras
- Um commit é uma mudança lógica. Não junte "agregado + tela + compose" no mesmo commit.
- Mudança que quebra o contrato leva `!` depois do escopo e `BREAKING CHANGE:` no rodapé.
- **Sem linhas de co-autoria** (`Co-Authored-By`) nem atribuição a ferramentas no commit ou no PR.
- O título do PR segue o mesmo formato, porque vira a mensagem no squash merge.
