// Acesso ao backend: leilao-escrita (8081) para comandos, leilao-leitura (8082) para consultas e agendador (8084).
import type { CriarLeilaoRequest, DarLanceRequest } from './types.ts'
import { normalizarRota, registrar } from './rede.ts'

/** Resposta de GET /leiloes/{id} (PLANO.md, seção 2.5). */
export interface EstadoLeilao {
  leilaoId: string
  titulo: string
  status: 'CRIADO' | 'ABERTO' | 'ENCERRADO' | 'CANCELADO'
  precoAtual: number | null
  liderId: string | null
  fimEm: string
  versao: number
}

/** Item de GET /leiloes?status=. */
export interface ResumoLeilao {
  leilaoId: string
  titulo: string
  status: EstadoLeilao['status']
  precoAtual: number | null
  fimEm: string
}

/** Item de GET /leiloes/{id}/lances. */
export interface LanceHistorico { versao: number; licitanteId: string; valor: number; criadoEm: string }

/** Item de GET /leiloes/{id}/eventos. */
export interface EventoGravado { versao: number; tipo: string; dados: unknown; criadoEm: string }

export type ConfiguracaoCache = 'A' | 'B' | 'C'

/** Resposta de POST /admin/cache/reconstruir. */
export interface RelatorioReconstrucao {
  leiloes: number
  chavesApagadas: number
  checkpointsApagados: number
  refeitos: number
  diferentes: string[]
  tempos: { fotografiaMs: number; apagarMs: number; refazerMs: number; compararMs: number }
}

export type SaudeInfra = Record<'postgres' | 'redis' | 'kafka', { status: 'UP' | 'DOWN'; ms: number; erro?: string }>

/** Mensagem do stream: o estado, mais o evento que o causou (ausente na primeira mensagem). */
export type EstadoComEvento = EstadoLeilao & { evento?: { tipo: string; versao: number } }

export type ResultadoLance =
  | { tipo: 'aceito'; versao: number; tentativas: number }
  | { tipo: 'recusado'; codigo?: string; mensagem?: string; tentativas: number }   // 422: regra violada (ex.: LANCE_ABAIXO_DO_MINIMO)
  | { tipo: 'conflito'; tentativas: number }                    // 409: versão disputada por outro lance mesmo após as retentativas
  | { tipo: 'erro'; status: number }        // status 0 = falha de rede

/** Erro HTTP com o status e, quando o backend mandou, o corpo {erro, mensagem}. */
export class ErroHttp extends Error {
  status: number
  codigo?: string
  constructor(status: number, mensagem: string, codigo?: string) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
  }
}

export type Servico = 'escrita' | 'leitura'


export interface Metrica {
  name: string
  baseUnit?: string
  measurements: { statistic: string; value: number }[]
  availableTags: { tag: string; values: string[] }[]
}

export interface Api {
  /** GET /actuator/metrics/{nome}?tag=chave:valor (várias tags) no serviço escolhido. Lança ErroHttp. */
  lerMetrica(servico: Servico, nome: string, tags?: string[]): Promise<Metrica>
  criarLeilao(req: CriarLeilaoRequest): Promise<{ leilaoId: string; versao: number }>
  darLance(leilaoId: string, req: DarLanceRequest): Promise<ResultadoLance>
 
  consultarLeilao(leilaoId: string, versaoMinima?: number): Promise<EstadoLeilao>
  historicoLances(leilaoId: string): Promise<LanceHistorico[]>

  listarLeiloes(status?: EstadoLeilao['status']): Promise<ResumoLeilao[]>
  cancelarLeilao(leilaoId: string, motivo: string): Promise<{ versao: number }>
  
  observarLeilao(leilaoId: string, aoMudar: (estado: EstadoComEvento, bytes: number) => void, aoFalhar?: () => void): () => void

  lerConfiguracaoCache(s: Servico): Promise<ConfiguracaoCache>
  trocarConfiguracaoCache(s: Servico, c: ConfiguracaoCache): Promise<ConfiguracaoCache>
  eventos(leilaoId: string): Promise<EventoGravado[]>
  estadoNaVersao(leilaoId: string, versao: number): Promise<EstadoLeilao>
  reconstruirCache(): Promise<RelatorioReconstrucao>
  saudeInfra(): Promise<SaudeInfra>
  saudeServico(s: Servico | 'agendador'): Promise<{ status: string; ms: number }>
}

const ESCRITA = import.meta.env.VITE_COMMAND_API ?? 'http://localhost:8081'
const LEITURA = import.meta.env.VITE_QUERY_API ?? 'http://localhost:8082'
const AGENDADOR = import.meta.env.VITE_SCHEDULER_API ?? 'http://localhost:8084'

const base = (s: Servico | 'agendador') => (s === 'escrita' ? ESCRITA : s === 'leitura' ? LEITURA : AGENDADOR)

/** fetch que registra método, rota, status, tempo e bytes do corpo no medidor de rede. */
async function medir(url: string, init?: RequestInit): Promise<Response> {
  const inicio = performance.now()
  const metodo = (init?.method ?? 'GET').toUpperCase()
  const rota = normalizarRota(url)
  let r: Response
  try {
    r = await fetch(url, init)
  } catch (e) {
    registrar({ quando: Date.now(), metodo, rota, status: 0, ms: performance.now() - inicio, bytes: 0, tipo: 'http' })
    throw e
  }
  // ms termina quando os cabeçalhos chegam; os bytes são contados depois, sem atrasar quem chamou.
  const ms = performance.now() - inicio
  const quando = Date.now()
  const status = r.status
  r.clone().arrayBuffer().then((b) => b.byteLength, () => 0)
    .then((bytes) => registrar({ quando, metodo, rota, status, ms, bytes, tipo: 'http' }))
  return r
}

const CODIFICADOR = new TextEncoder()
const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Lê {erro, mensagem}; o 404 da leitura vem no formato padrão do Spring, então o corpo é opcional. */
async function erroDe(r: Response, rotulo: string): Promise<ErroHttp> {
  const corpo = await r.json().catch(() => null) as { erro?: string; mensagem?: string } | null
  return new ErroHttp(r.status, corpo?.mensagem ?? `${rotulo} → ${r.status}`, corpo?.erro)
}

async function getJson<T>(url: string): Promise<T> {
  const r = await medir(url)
  if (!r.ok) throw await erroDe(r, `GET ${url}`)
  return r.json() as Promise<T>
}

async function configuracao(s: Servico, init?: RequestInit): Promise<ConfiguracaoCache> {
  const url = `${base(s)}/admin/cache/configuracao`
  const r = await medir(url, init)
  if (!r.ok) throw await erroDe(r, `${init?.method ?? 'GET'} ${url}`)
  return ((await r.json()) as { configuracao: ConfiguracaoCache }).configuracao
}

export const api: Api = {
  lerMetrica: (servico, nome, tags) =>
    getJson(`${base(servico)}/actuator/metrics/${nome}${tags?.length ? `?${tags.map((t) => `tag=${encodeURIComponent(t)}`).join('&')}` : ''}`),
  async criarLeilao(req) {
    const r = await medir(`${ESCRITA}/leiloes`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(req),
    })
    if (!r.ok) throw await erroDe(r, 'POST /leiloes')
    return r.json()
  },
  async darLance(leilaoId, req) {
    let r: Response
    try {
      r = await medir(`${ESCRITA}/leiloes/${leilaoId}/lances`, {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(req),
      })
    } catch {
      return { tipo: 'erro', status: 0 }
    }
    if (r.ok) {
      const corpo = await r.json() as { versao: number; tentativas: number }
      return { tipo: 'aceito', versao: corpo.versao, tentativas: corpo.tentativas }
    }
    if (r.status === 422) {
      const corpo = await r.json().catch(() => null) as { erro?: string; mensagem?: string; tentativas?: number } | null
      return { tipo: 'recusado', codigo: corpo?.erro, mensagem: corpo?.mensagem ?? `lance → ${r.status}`, tentativas: corpo?.tentativas ?? 1 }
    }
    if (r.status === 409) {
      const corpo = await r.json().catch(() => null) as { tentativas?: number } | null
      return { tipo: 'conflito', tentativas: corpo?.tentativas ?? 3 }
    }
    return { tipo: 'erro', status: r.status }
  },
  consultarLeilao: (id, versaoMinima) =>
    getJson(`${LEITURA}/leiloes/${id}${versaoMinima ? `?versaoMinima=${versaoMinima}` : ''}`),
  historicoLances: (id) => getJson(`${LEITURA}/leiloes/${id}/lances`),
  listarLeiloes: (status) => getJson(`${LEITURA}/leiloes${status ? `?status=${status}` : ''}`),
  async cancelarLeilao(leilaoId, motivo) {
    const r = await medir(`${ESCRITA}/leiloes/${leilaoId}/cancelar`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ motivo }),
    })
    if (!r.ok) throw await erroDe(r, 'POST cancelar')
    return r.json()
  },
  observarLeilao(leilaoId, aoMudar, aoFalhar) {
    const url = `${LEITURA}/leiloes/${leilaoId}/stream`
    const rota = normalizarRota(url)
    const fonte = new EventSource(url)
    fonte.addEventListener('leilao', (ev) => {
      const dados = (ev as MessageEvent).data as string
      const bytes = CODIFICADOR.encode(dados).length
      registrar({ quando: Date.now(), metodo: 'SSE', rota, status: 200, ms: 0, bytes, tipo: 'sse' })
      aoMudar(JSON.parse(dados), bytes)
    })
    fonte.onerror = () => aoFalhar?.() // o EventSource reconecta sozinho; a tela só avisa
    return () => fonte.close()
  },
  lerConfiguracaoCache: (s) => configuracao(s),
  trocarConfiguracaoCache: (s, c) =>
    configuracao(s, { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ configuracao: c }) }),
  eventos: (id) => getJson(`${LEITURA}/leiloes/${id}/eventos`),
  estadoNaVersao: (id, versao) => getJson(`${LEITURA}/leiloes/${id}?ateVersao=${versao}`),
  async reconstruirCache() {
    const url = `${ESCRITA}/admin/cache/reconstruir`
    const r = await medir(url, { method: 'POST', headers: JSON_HEADERS, body: '{}' }) // o backend exige JSON
    if (!r.ok) throw await erroDe(r, `POST ${url}`)
    return r.json()
  },
  saudeInfra: () => getJson(`${LEITURA}/infra/saude`),
  async saudeServico(s) {
    // Só falha de rede lança: um 503 com corpo é um serviço DOWN, não um erro.
    const inicio = performance.now()
    const r = await medir(`${base(s)}/actuator/health`)
    const ms = performance.now() - inicio
    const corpo = await r.json().catch(() => null) as { status?: string } | null
    return { status: corpo?.status ?? (r.ok ? 'UP' : 'DOWN'), ms }
  },
}
