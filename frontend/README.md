# Frontend

Vite + React + TypeScript. A infra e a documentação estão na raiz: veja o [README principal](../README.md).

```bash
cp .env.example .env
npm install
npm run dev      # build: npm run build | lint: npm run lint
```

## Variáveis
- `VITE_COMMAND_API`: API de comandos (padrão `http://localhost:8081`)
- `VITE_QUERY_API`: API de consulta (padrão `http://localhost:8082`)

`src/types.ts` espelha `backend/contracts`: mudou um, muda o outro no mesmo PR.
