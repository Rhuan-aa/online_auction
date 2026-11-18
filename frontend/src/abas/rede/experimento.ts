// Experimento SSE × polling: quem percebe cada lance primeiro, e a que custo.
import type { EstadoComEvento, EstadoLeilao } from '../../api.ts'

export type Via = 'sse' | 'polling'

export interface Percepcao { versao: number; aceitoEm: number | null; viaSse: number | null; viaPolling: number | null }

function da(m: Map<number, Percepcao>, versao: number): Percepcao {
  let p = m.get(versao)
  if (!p) { p = { versao, aceitoEm: null, viaSse: null, viaPolling: null }; m.set(versao, p) }
  return p
}

export function registrarAceite(m: Map<number, Percepcao>, versao: number, quando: number): void {
  da(m, versao).aceitoEm = quando
}

/** Só o primeiro "visto" de cada via conta. */
export function registrarVisto(m: Map<number, Percepcao>, versao: number, via: Via, quando: number): void {
  const p = da(m, versao)
  if (via === 'sse') p.viaSse ??= quando
  else p.viaPolling ??= quando
}

/** Atraso = visto − aceito, só para versões aceitas nesta janela; as outras contam em naoMedidos. */
export function atrasos(m: Map<number, Percepcao>): { sse: number[]; polling: number[]; naoMedidos: number } {
  const r = { sse: [] as number[], polling: [] as number[], naoMedidos: 0 }
  for (const p of [...m.values()].sort((a, b) => a.versao - b.versao)) {
    if (p.aceitoEm === null) { r.naoMedidos++; continue }
    if (p.viaSse !== null) r.sse.push(p.viaSse - p.aceitoEm)
    if (p.viaPolling !== null) r.polling.push(p.viaPolling - p.aceitoEm)
  }
  return r
}

export interface Custo { requisicoes: number; bytes: number }
export interface Snapshot { sse: Custo; polling: Custo; percepcoes: Map<number, Percepcao> }

export interface ApiExperimento {
  observarLeilao(id: string, aoMudar: (e: EstadoComEvento) => void, aoFalhar?: () => void): () => void
  consultarLeilao(id: string): Promise<EstadoLeilao>
}

const CODIFICADOR = new TextEncoder()
const bytesDe = (o: unknown) => CODIFICADOR.encode(JSON.stringify(o)).length

export interface Experimento {
  parar(): void
  aceitou(versao: number): void
  snapshot(): Snapshot
}

/** Abre a assinatura SSE e o laço de polling; cada via guarda a última versão vista (a primeira resposta é só a base). */
export function iniciarExperimento(
  api: ApiExperimento, leilaoId: string, intervaloMs: number, aoMudar: () => void,
): Experimento {
  const sse: Custo = { requisicoes: 0, bytes: 0 }
  const polling: Custo = { requisicoes: 0, bytes: 0 }
  const percepcoes = new Map<number, Percepcao>()
  let ativo = true
  let ultimaSse: number | null = null
  let ultimaPolling: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  const fecharSse = api.observarLeilao(leilaoId, (e) => {
    if (!ativo) return
    sse.requisicoes++
    sse.bytes += bytesDe(e)
    if (ultimaSse !== null && e.versao > ultimaSse) registrarVisto(percepcoes, e.versao, 'sse', Date.now())
    ultimaSse = Math.max(ultimaSse ?? 0, e.versao)
    aoMudar()
  })

  async function ciclo() {
    if (!ativo) return
    polling.requisicoes++
    try {
      const e = await api.consultarLeilao(leilaoId)
      if (!ativo) return
      polling.bytes += bytesDe(e)
      if (ultimaPolling !== null && e.versao > ultimaPolling) registrarVisto(percepcoes, e.versao, 'polling', Date.now())
      ultimaPolling = Math.max(ultimaPolling ?? 0, e.versao)
    } catch { /* a requisição conta; sem corpo, sem bytes */ }
    if (!ativo) return
    aoMudar()
    timer = setTimeout(ciclo, intervaloMs)
  }
  void ciclo()

  return {
    parar() { ativo = false; clearTimeout(timer); fecharSse() },
    aceitou(versao) { registrarAceite(percepcoes, versao, Date.now()); aoMudar() },
    snapshot: () => ({ sse: { ...sse }, polling: { ...polling }, percepcoes: new Map(percepcoes) }),
  }
}

export const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
export const maximo = (xs: number[]) => (xs.length ? Math.max(...xs) : null)
