# Contrato `leilao-corrida` (8085) ↔ front

Dinheiro em centavos (long), tempos em ms (número com 1 casa decimal), datas ISO-8601.

## POST /corrida
Corpo:
```json
{ "licitantes": 20, "lancesPorLicitante": 10, "simultaneos": 6, "leitores": 4, "precoInicial": 10000, "incremento": 100 }
```
- Valida que todos são inteiros ≥ 1 (`simultaneos` e `leitores` podem ser ≥ 1; `leitores` pode ser 0). Inválido → 400 `{"erro":"PARAMETRO_INVALIDO","mensagem":"..."}`.
- Já existe corrida rodando → 409 `{"erro":"CORRIDA_EM_ANDAMENTO","mensagem":"..."}`.
- OK → 201 `{"corridaId":"<uuid>"}`.

## POST /corrida/{id}/parar → 204 (idempotente). 404 se não existe.

## GET /corrida/{id} → 200 com o último `Foto` (ou `Resultado` se terminou). 404 se não existe.

## GET /corrida/{id}/stream (SSE)
- Evento `foto` a cada 250 ms enquanto roda (e uma vez ao conectar).
- Evento `fim` uma única vez, ao terminar (todas concluídas, paradas ou com erro); depois o servidor fecha o stream.

### `Foto` (dados do evento `foto`)
```json
{
  "corridaId": "uuid",
  "parametros": { "licitantes": 20, "lancesPorLicitante": 10, "simultaneos": 6, "leitores": 4, "precoInicial": 10000, "incremento": 100 },
  "decorridoMs": 1234.5,
  "rodando": true,
  "arquiteturas": [ ArqFoto, ... 6 itens, nesta ordem: crud, crud-cache, es, es-snapshot, es-cache, es-cqrs ]
}
```
`ArqFoto`:
```json
{
  "id": "es-cache",
  "nome": "ES + cache",
  "descricao": "Eventos imutáveis + cópia versionada no Redis",
  "status": "rodando",              // "rodando" | "terminou" | "parada" | "erro"
  "erro": null,                      // mensagem se status = erro
  "terminouEmMs": null,              // número quando terminou
  "total": 200, "enviados": 120, "aceitos": 80, "recusados": 40, "conflitos": 12, "retentativas": 15,
  "lancesPorSegundo": 97.3,
  "escrita": { "p50": 4.2, "p95": 11.8, "amostras": 120 },
  "leitura": { "p50": 1.1, "p95": 3.0, "consultas": 900, "desatualizadas": 0, "pctDesatualizadas": 0.0, "atrasoMedioVersoes": 0.0, "atrasoMedioMs": 0.0 },
  "curva": [ { "versao": 10, "ms": 3.9 }, { "versao": 20, "ms": 4.1 } ],   // média do tempo de escrita por faixa de 10 versões
  "operacoes": { "leiturasBanco": 300, "escritasBanco": 80, "opsRedis": 200, "porLance": 7.25 },
  "precoAtual": 18000, "liderAtual": "licitante-3", "versaoAtual": 81
}
```

### `Resultado` (dados do evento `fim`) = `Foto` com `rodando:false` e, em cada arquitetura, os campos extras:
```json
{
  "integridade": { "ok": true, "umVencedor": true, "precoFinalCorreto": true, "lancesPerdidos": 0, "detalhe": "..." },
  "espaco": { "linhas": 1, "eventos": 81, "chavesRedis": 2, "bytes": 49152 },
  "auditoria": { "suporta": true, "eventos": 81 },
  "precoFinal": 18000, "vencedor": "licitante-3"
}
```
- `lancesPerdidos` (só faz sentido em `crud`): lances confirmados ao cliente como aceitos cujo valor ficou acima do preço final ou cujo efeito foi sobrescrito por outro lance concorrente lido sobre o mesmo estado (lost update). Nas demais arquiteturas deve ser 0.
- `precoFinalCorreto`: preço final = maior valor entre os lances aceitos.
- `operacoes.porLance` = (leiturasBanco + escritasBanco + opsRedis) ÷ lances **enviados** (inclui recusados, que também custam).
- `leitura.pctDesatualizadas` está em 0–100; o front pode calcular de `desatualizadas / consultas`.
- `terminouEmMs` = tempo desde o início da corrida até a arquitetura terminar.
- p50/p95 valem 0 quando não há amostras (`amostras`/`consultas` = 0); o front deve mostrar "—" nesse caso.
- `POST /corrida` aceita `semente` opcional (padrão 42).
- CORS: `http://localhost:5173`, métodos GET e POST.
