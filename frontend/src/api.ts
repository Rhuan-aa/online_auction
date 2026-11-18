// Acesso ao backend: leilao-escrita (8081) para comandos e leilao-leitura (8082) para consultas.
import type { CriarLeilaoRequest, DarLanceRequest } from './types.ts'

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

/** Item de GET /leiloes/{id}/eventos. */
export interface EventoGravado { versao: number; tipo: string; dados: unknown; criadoEm: string }

/** Mensagem do stream: o estado, mais o evento que o causou (ausente na primeira mensagem). */
export type EstadoComEvento = EstadoLeilao & { evento?: { tipo: string; versao: number } }

export type ResultadoLance =
  | { tipo: 'aceito'; versao: number; tentativas: number }
  | { tipo: 'recusado'; codigo?: string; mensagem?: string; tentativas: number }   // 422: regra violada (ex.: LANCE_ABAIXO_DO_MINIMO)
  | { tipo: 'conflito'; tentativas: number }                    // 409: versão disputada por outro lance mesmo após as retentativas
  | { tipo: 'erro'; status: number }        // status 0 = falha de rede

/** Erro HTTP com o status e, quando o backend mandou, o corpo {erro, mensagem}. Status 0 = sem conexão. */
export class ErroHttp extends Error {
  status: number
  codigo?: string
  constructor(status: number, mensagem: string, codigo?: string) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
  }
}

export interface Api {
  criarLeilao(req: CriarLeilaoRequest): Promise<{ leilaoId: string; versao: number }>
  darLance(leilaoId: string, req: DarLanceRequest): Promise<ResultadoLance>
  consultarLeilao(leilaoId: string): Promise<EstadoLeilao>
  listarLeiloes(status?: EstadoLeilao['status']): Promise<ResumoLeilao[]>
  observarLeilao(leilaoId: string, aoMudar: (estado: EstadoComEvento) => void, aoFalhar?: () => void): () => void
  eventos(leilaoId: string): Promise<EventoGravado[]>
  estadoNaVersao(leilaoId: string, versao: number): Promise<EstadoLeilao>
}

const ESCRITA = import.meta.env.VITE_COMMAND_API ?? 'http://localhost:8081'
const LEITURA = import.meta.env.VITE_QUERY_API ?? 'http://localhost:8082'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** Lê {erro, mensagem}; o 404 da leitura vem no formato padrão do Spring, então o corpo é opcional. */
export async function erroDe(r: Response, rotulo: string): Promise<ErroHttp> {
  const corpo = await r.json().catch(() => null) as { erro?: string; mensagem?: string } | null
  return new ErroHttp(r.status, corpo?.mensagem ?? `${rotulo} → ${r.status}`, corpo?.erro)
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw await erroDe(r, `GET ${url}`)
  return r.json() as Promise<T>
}

export const api: Api = {
  async criarLeilao(req) {
    const r = await fetch(`${ESCRITA}/leiloes`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(req) })
    if (!r.ok) throw await erroDe(r, 'POST /leiloes')
    return r.json()
  },
  async darLance(leilaoId, req) {
    let r: Response
    try {
      r = await fetch(`${ESCRITA}/leiloes/${leilaoId}/lances`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(req) })
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
  consultarLeilao: (id) => getJson(`${LEITURA}/leiloes/${id}`),
  listarLeiloes: (status) => getJson(`${LEITURA}/leiloes${status ? `?status=${status}` : ''}`),
  observarLeilao(leilaoId, aoMudar, aoFalhar) {
    const fonte = new EventSource(`${LEITURA}/leiloes/${leilaoId}/stream`)
    fonte.addEventListener('leilao', (ev) => aoMudar(JSON.parse((ev as MessageEvent).data as string)))
    fonte.onerror = () => aoFalhar?.() // o EventSource reconecta sozinho; a tela só avisa
    return () => fonte.close()
  },
  eventos: (id) => getJson(`${LEITURA}/leiloes/${id}/eventos`),
  estadoNaVersao: (id, versao) => getJson(`${LEITURA}/leiloes/${id}?ateVersao=${versao}`),
}
