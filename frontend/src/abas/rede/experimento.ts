// Experimento SSE × polling: quem percebe cada lance primeiro, e a que custo.
import type { EstadoComEvento, EstadoLeilao } from '../../api.ts'

export type Via = 'sse' | 'polling'

/**
 * `aceitoEm` é o instante em que o lance foi ENVIADO (não o da resposta do POST): o atraso é medido
 * "desde o envio do lance", um limite superior que não depende da ordem de chegada e é justo para as duas vias.
 */
export interface Percepcao { versao: number; aceitoEm: number | null; viaSse: number | null; viaPolling: number | null }

function da(m: Map<number, Percepcao>, versao: number): Percepcao {
  let p = m.get(versao)
  if (!p) { p = { versao, aceitoEm: null, viaSse: null, viaPolling: null }; m.set(versao, p) }
  return p
}

/** `envioEm`: quando o lance foi enviado. */
export function registrarAceite(m: Map<number, Percepcao>, versao: number, envioEm: number): void {
  da(m, versao).aceitoEm = envioEm
}

/** Só o primeiro "visto" de cada via conta. */
export function registrarVisto(m: Map<number, Percepcao>, versao: number, via: Via, quando: number): void {
  const p = da(m, versao)
  if (via === 'sse') p.viaSse ??= quando
  else p.viaPolling ??= quando
}

/**
 * Atraso = visto − envio, só para versões enviadas por esta janela; as outras contam em naoMedidos.
 * Um atraso negativo (relógio estranho) fica fora das médias e a versão conta em naoMedidos.
 */
export function atrasos(m: Map<number, Percepcao>): { sse: number[]; polling: number[]; naoMedidos: number } {
  const r = { sse: [] as number[], polling: [] as number[], naoMedidos: 0 }
  for (const p of [...m.values()].sort((a, b) => a.versao - b.versao)) {
    if (p.aceitoEm === null) { r.naoMedidos++; continue }
    let negativo = false
    for (const [via, visto] of [['sse', p.viaSse], ['polling', p.viaPolling]] as const) {
      if (visto === null) continue
      const d = visto - p.aceitoEm
      if (d < 0) negativo = true
      else r[via].push(d)
    }
    if (negativo) r.naoMedidos++
  }
  return r
}

/** O lance do experimento só vale para o leilão medido: se o foco mudou, não há estado para usar. */
export function estadoDoExperimento(leilaoId: string, estado: EstadoLeilao | null): EstadoLeilao | null {
  return estado && estado.leilaoId === leilaoId ? estado : null
}

export interface Custo { requisicoes: number; bytes: number }
export interface Snapshot { sse: Custo; polling: Custo; percepcoes: Map<number, Percepcao> }

export interface ApiExperimento {
  observarLeilao(id: string, aoMudar: (e: EstadoComEvento, bytes: number) => void, aoFalhar?: () => void): () => void
  consultarLeilao(id: string): Promise<EstadoLeilao>
}

const CODIFICADOR = new TextEncoder()
const bytesDe = (o: unknown) => CODIFICADOR.encode(JSON.stringify(o)).length

export interface Experimento {
  leilaoId: string
  parar(): void
  /** `envioEm`: instante em que o lance foi enviado. */
  aceitou(versao: number, envioEm: number): void
  snapshot(): Snapshot
}

/**
 * Abre a assinatura SSE e o laço de polling; cada via guarda a última versão vista
 * (a primeira resposta de cada via é só a base, não conta como "visto").
 * Bytes do SSE: o corpo real da mensagem. Bytes do polling: o JSON da resposta reserializado
 * (o corpo exato não chega até aqui sem separar as requisições do palco das do experimento).
 */
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

  const fecharSse = api.observarLeilao(leilaoId, (e, bytes) => {
    if (!ativo) return
    sse.requisicoes++
    sse.bytes += bytes
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
    leilaoId,
    parar() { ativo = false; clearTimeout(timer); fecharSse() },
    aceitou(versao, envioEm) { if (!ativo) return; registrarAceite(percepcoes, versao, envioEm); aoMudar() },
    snapshot: () => ({ sse: { ...sse }, polling: { ...polling }, percepcoes: new Map(percepcoes) }),
  }
}

export const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
export const maximo = (xs: number[]) => (xs.length ? Math.max(...xs) : null)
