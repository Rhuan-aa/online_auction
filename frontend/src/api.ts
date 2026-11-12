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

/** Item de GET /leiloes/{id}/lances. */
export interface LanceHistorico { versao: number; licitanteId: string; valor: number; criadoEm: string }

export type ResultadoLance =
  | { tipo: 'aceito'; versao: number }
  | { tipo: 'recusado'; codigo?: string; mensagem?: string }   // 422: regra violada (ex.: LANCE_ABAIXO_DO_MINIMO)
  | { tipo: 'conflito' }                    // 409: versão disputada por outro lance mesmo após as retentativas
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

export interface Api {
  criarLeilao(req: CriarLeilaoRequest): Promise<{ leilaoId: string; versao: number }>
  darLance(leilaoId: string, req: DarLanceRequest): Promise<ResultadoLance>
  /** COM CQRS: lê a projeção pronta (read_model). */
  consultarComCqrs(leilaoId: string): Promise<EstadoLeilao>
  /** SEM CQRS: carrega todos os eventos e reconstrói o estado a cada consulta. */
  consultarSemCqrs(leilaoId: string): Promise<EstadoLeilao>
  historicoLances(leilaoId: string): Promise<LanceHistorico[]>
  /** GET /leiloes?status= (leitura). Sem status, lista todos. */
  listarLeiloes(status?: EstadoLeilao['status']): Promise<ResumoLeilao[]>
  /** POST /leiloes/{id}/cancelar. Lança ErroHttp (422 se já tem lance, por exemplo). */
  cancelarLeilao(leilaoId: string, motivo: string): Promise<{ versao: number }>
  /**
   * Acompanha o leilão ao vivo (SSE no real). Manda o estado atual ao assinar e de novo a cada mudança.
   * Devolve a função que encerra a assinatura.
   */
  observarLeilao(leilaoId: string, aoMudar: (estado: EstadoLeilao) => void, aoFalhar?: () => void): () => void
}

// ---------------------------------------------------------------- real

const ESCRITA = import.meta.env.VITE_COMMAND_API ?? 'http://localhost:8081'
const LEITURA = import.meta.env.VITE_QUERY_API ?? 'http://localhost:8082'

/** Lê {erro, mensagem}; o 404 da leitura vem no formato padrão do Spring, então o corpo é opcional. */
async function erroDe(r: Response, rotulo: string): Promise<ErroHttp> {
  const corpo = await r.json().catch(() => null) as { erro?: string; mensagem?: string } | null
  return new ErroHttp(r.status, corpo?.mensagem ?? `${rotulo} → ${r.status}`, corpo?.erro)
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw await erroDe(r, `GET ${url}`)
  return r.json() as Promise<T>
}

const apiReal: Api = {
  async criarLeilao(req) {
    const r = await fetch(`${ESCRITA}/leiloes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
    })
    if (!r.ok) throw await erroDe(r, 'POST /leiloes')
    return r.json()
  },
  async darLance(leilaoId, req) {
    let r: Response
    try {
      r = await fetch(`${ESCRITA}/leiloes/${leilaoId}/lances`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
      })
    } catch {
      return { tipo: 'erro', status: 0 }
    }
    if (r.ok) return { tipo: 'aceito', versao: (await r.json()).versao }
    if (r.status === 422) {
      const e = await erroDe(r, 'lance')
      return { tipo: 'recusado', codigo: e.codigo, mensagem: e.message }
    }
    if (r.status === 409) return { tipo: 'conflito' }
    return { tipo: 'erro', status: r.status }
  },
  consultarComCqrs: (id) => getJson(`${LEITURA}/leiloes/${id}`),
  // Rota de experimento no leilao-escrita: carregar(eventos) + reconstituir(). Só existe para a comparação.
  consultarSemCqrs: (id) => getJson(`${ESCRITA}/experimento/sem-cqrs/leiloes/${id}`),
  historicoLances: (id) => getJson(`${LEITURA}/leiloes/${id}/lances`),
  listarLeiloes: (status) => getJson(`${LEITURA}/leiloes${status ? `?status=${status}` : ''}`),
  async cancelarLeilao(leilaoId, motivo) {
    const r = await fetch(`${ESCRITA}/leiloes/${leilaoId}/cancelar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo }),
    })
    if (!r.ok) throw await erroDe(r, 'POST cancelar')
    return r.json()
  },
  observarLeilao(leilaoId, aoMudar, aoFalhar) {
    const fonte = new EventSource(`${LEITURA}/leiloes/${leilaoId}/stream`)
    fonte.addEventListener('leilao', (ev) => aoMudar(JSON.parse((ev as MessageEvent).data)))
    fonte.onerror = () => aoFalhar?.() // o EventSource reconecta sozinho; a tela só avisa
    return () => fonte.close()
  },
}

export const api: Api = apiReal
