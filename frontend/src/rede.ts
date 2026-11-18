// Medidor de rede: guarda as requisições e mensagens SSE que passaram por api.ts.
export interface Registro {
  id: number
  quando: number
  metodo: string
  rota: string
  status: number
  ms: number
  bytes: number
  tipo: 'http' | 'sse'
}

const LIMITE = 500
let lista: Registro[] = []
let proximoId = 1
const ouvintes = new Set<(r: Registro) => void>()

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Tira a origem e a query e troca UUIDs por {id}. O método fica fora: é um campo à parte. */
export function normalizarRota(url: string): string {
  const semOrigem = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '')
  const caminho = semOrigem.split(/[?#]/)[0]
  return caminho.replace(UUID, '{id}')
}

export function registrar(r: Omit<Registro, 'id'>): void {
  const registro = { ...r, id: proximoId++ }
  lista.push(registro)
  if (lista.length > LIMITE) lista = lista.slice(-LIMITE)
  ouvintes.forEach((fn) => fn(registro))
}

export function assinar(fn: (r: Registro) => void): () => void {
  ouvintes.add(fn)
  return () => { ouvintes.delete(fn) }
}

export function registros(): Registro[] {
  return [...lista]
}

export function limpar(): void {
  lista = []
  proximoId = 1
}

/** Agrupa por "METODO /rota" (ex.: "GET /leiloes/{id}/lances"), do que mais pesou para o que menos. */
export function resumoPorRota(rs: Registro[]): { rota: string; requisicoes: number; bytes: number; msMedio: number }[] {
  const grupos = new Map<string, { requisicoes: number; bytes: number; ms: number; comTempo: number }>()
  for (const r of rs) {
    const chave = `${r.metodo} ${r.rota}`
    const g = grupos.get(chave) ?? { requisicoes: 0, bytes: 0, ms: 0, comTempo: 0 }
    g.requisicoes++
    g.bytes += r.bytes
    if (r.tipo !== 'sse') { g.ms += r.ms; g.comTempo++ } // SSE não tem tempo de resposta
    grupos.set(chave, g)
  }
  return [...grupos.entries()]
    .map(([rota, g]) => ({ rota, requisicoes: g.requisicoes, bytes: g.bytes, msMedio: g.comTempo ? g.ms / g.comTempo : 0 }))
    .sort((a, b) => b.bytes - a.bytes)
}
