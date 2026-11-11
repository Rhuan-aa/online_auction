// Acesso ao backend. Duas implementações com a mesma interface:
//  - real:      chama leilao-escrita (8081) e leilao-leitura (8082)
//  - simulado:  tudo em memória, só para desenvolver a tela sem o backend pronto
// Escolha com VITE_MODO=real no frontend/.env (padrão: simulado).
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
  | { tipo: 'recusado'; codigo?: string }   // 422: regra violada (ex.: LANCE_ABAIXO_DO_MINIMO)
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
  modo: 'real' | 'simulado'
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
  modo: 'real',
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
    if (r.status === 422) return { tipo: 'recusado', codigo: (await erroDe(r, 'lance')).codigo }
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

// ---------------------------------------------------------------- simulado
// Imita o comportamento do backend: event store com versão otimista, projeção que
// chega atrasada (consistência eventual) e leitura sem CQRS que relê todos os eventos.
// Os tempos são artificiais: servem para testar a tela, NÃO para apresentar.

type Evento =
  | { tipo: 'LeilaoCriado'; vendedorId: string; titulo: string; precoInicial: number; incrementoMinimo: number; fimEm: string }
  | { tipo: 'LeilaoIniciado' }
  | { tipo: 'LeilaoCancelado' }
  | { tipo: 'LanceRegistrado'; licitanteId: string; valor: number; criadoEm: string }

const naoEncontrado = () => new ErroHttp(404, 'Leilão não encontrado', 'LEILAO_NAO_ENCONTRADO')
const esperar = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
const rede = () => esperar(3 + Math.random() * 5)          // ida e volta HTTP
const CUSTO_POR_EVENTO_MS = 0.15                            // ler uma linha de eventos + aplicar

/** Reconstrói o estado aplicando os eventos em ordem (o "reconstituir" do agregado). */
function reconstituir(leilaoId: string, eventos: Evento[]) {
  const estado: EstadoLeilao = { leilaoId, titulo: '', status: 'CRIADO', precoAtual: null, liderId: null, fimEm: '', versao: 0 }
  let incrementoMinimo = 0
  let vendedorId = ''
  for (const ev of eventos) {
    estado.versao++
    if (ev.tipo === 'LeilaoCriado') {
      Object.assign(estado, { titulo: ev.titulo, precoAtual: ev.precoInicial, fimEm: ev.fimEm })
      incrementoMinimo = ev.incrementoMinimo
      vendedorId = ev.vendedorId
    }
    if (ev.tipo === 'LeilaoIniciado') estado.status = 'ABERTO'
    if (ev.tipo === 'LeilaoCancelado') estado.status = 'CANCELADO'
    if (ev.tipo === 'LanceRegistrado') Object.assign(estado, { precoAtual: ev.valor, liderId: ev.licitanteId })
  }
  return { estado, incrementoMinimo, vendedorId }
}

const eventStore = new Map<string, Evento[]>()
const projecao = new Map<string, { estado: EstadoLeilao; lances: LanceHistorico[] }>()

/** Projeção: aplica o evento no read model depois de um atraso (Kafka + projector). */
function projetar(leilaoId: string) {
  setTimeout(() => {
    const eventos = eventStore.get(leilaoId)!
    const { estado } = reconstituir(leilaoId, eventos)
    const lances = eventos.flatMap((ev, i) =>
      ev.tipo === 'LanceRegistrado' ? [{ versao: i + 1, licitanteId: ev.licitanteId, valor: ev.valor, criadoEm: ev.criadoEm }] : [])
    const atual = projecao.get(leilaoId)
    if (!atual || atual.estado.versao < estado.versao) {                                          // idempotente por versão
      projecao.set(leilaoId, { estado, lances })
      avisarObservadores()
    }
  }, 40 + Math.random() * 80)
}

const observadoresSimulados = new Set<() => void>()
/** O "SSE" do simulado: avisa os observadores quando a projeção de algum leilão muda. */
function avisarObservadores() { observadoresSimulados.forEach((f) => f()) }

const apiSimulada: Api = {
  modo: 'simulado',
  async criarLeilao(req) {
    await rede()
    const leilaoId = crypto.randomUUID()
    eventStore.set(leilaoId, [{ tipo: 'LeilaoCriado', vendedorId: req.vendedorId, titulo: req.titulo, precoInicial: req.precoInicial, incrementoMinimo: req.incrementoMinimo, fimEm: req.fimEm }])
    projetar(leilaoId)
    setTimeout(() => { eventStore.get(leilaoId)!.push({ tipo: 'LeilaoIniciado' }); projetar(leilaoId) }, 300) // agendador
    return { leilaoId, versao: 1 }
  },
  async darLance(leilaoId, req) {
    await rede()
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const eventos = eventStore.get(leilaoId)
      if (!eventos) throw naoEncontrado()
      const { estado, incrementoMinimo, vendedorId } = reconstituir(leilaoId, eventos) // carregar + reconstituir
      if (estado.status !== 'ABERTO') return { tipo: 'recusado', codigo: 'LEILAO_NAO_ABERTO' }
      if (req.licitanteId === vendedorId) return { tipo: 'recusado', codigo: 'VENDEDOR_NAO_PODE_DAR_LANCE' }
      const minimo = estado.liderId ? estado.precoAtual! + incrementoMinimo : estado.precoAtual!
      if (req.valor < minimo) return { tipo: 'recusado', codigo: 'LANCE_ABAIXO_DO_MINIMO' }
      await esperar(Math.random() * 4)                            // tempo entre decidir e gravar
      if (eventos.length !== estado.versao) continue              // UNIQUE(leilao_id, versao) violado → recarrega
      eventos.push({ tipo: 'LanceRegistrado', licitanteId: req.licitanteId, valor: req.valor, criadoEm: new Date().toISOString() })
      projetar(leilaoId)
      return { tipo: 'aceito', versao: eventos.length }
    }
    return { tipo: 'conflito' }
  },
  async consultarComCqrs(leilaoId) {
    await rede()
    const p = projecao.get(leilaoId)
    if (!p) throw naoEncontrado()                                // projeção ainda não chegou
    return structuredClone(p.estado)                             // uma linha pronta
  },
  async consultarSemCqrs(leilaoId) {
    await rede()
    const eventos = eventStore.get(leilaoId)
    if (!eventos) throw naoEncontrado()
    await esperar(eventos.length * CUSTO_POR_EVENTO_MS)            // relê todas as linhas
    return reconstituir(leilaoId, eventos).estado
  },
  async historicoLances(leilaoId) {
    await rede()
    return structuredClone(projecao.get(leilaoId)?.lances ?? [])
  },
  async listarLeiloes(status) {
    await rede()
    return [...projecao.values()]
      .map(({ estado: e }) => ({ leilaoId: e.leilaoId, titulo: e.titulo, status: e.status, precoAtual: e.precoAtual, fimEm: e.fimEm }))
      .filter((l) => !status || l.status === status)
  },
  async cancelarLeilao(leilaoId, _motivo) {
    await rede()
    const eventos = eventStore.get(leilaoId)
    if (!eventos) throw naoEncontrado()
    const { estado } = reconstituir(leilaoId, eventos)
    if (estado.liderId) throw new ErroHttp(422, 'Leilão com lances não pode ser cancelado', 'HAS_BIDS')
    if (estado.status === 'ENCERRADO' || estado.status === 'CANCELADO') {
      throw new ErroHttp(422, 'O leilão não está aberto', 'LEILAO_NAO_ABERTO')
    }
    eventos.push({ tipo: 'LeilaoCancelado' })
    projetar(leilaoId)
    return { versao: eventos.length }
  },
  observarLeilao(leilaoId, aoMudar) {
    let ultima = -1
    const enviar = () => {
      const p = projecao.get(leilaoId)
      if (p && p.estado.versao !== ultima) { ultima = p.estado.versao; aoMudar(structuredClone(p.estado)) }
    }
    observadoresSimulados.add(enviar)
    enviar()
    return () => { observadoresSimulados.delete(enviar) }
  },
}

export const api: Api = import.meta.env.VITE_MODO === 'real' ? apiReal : apiSimulada
