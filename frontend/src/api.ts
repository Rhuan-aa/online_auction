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

/** Item de GET /leiloes/{id}/lances. */
export interface LanceHistorico { versao: number; licitanteId: string; valor: number; criadoEm: string }

export type ResultadoLance =
  | { tipo: 'aceito'; versao: number }
  | { tipo: 'recusado' }   // 422: regra violada (ex.: abaixo do mínimo)
  | { tipo: 'conflito' }   // 409: versão disputada por outro lance mesmo após as retentativas
  | { tipo: 'erro'; status: number }

export interface Api {
  modo: 'real' | 'simulado'
  criarLeilao(req: CriarLeilaoRequest): Promise<{ leilaoId: string }>
  darLance(leilaoId: string, req: DarLanceRequest): Promise<ResultadoLance>
  /** COM CQRS: lê a projeção pronta (read_model). */
  consultarComCqrs(leilaoId: string): Promise<EstadoLeilao>
  /** SEM CQRS: carrega todos os eventos e reconstrói o estado a cada consulta. */
  consultarSemCqrs(leilaoId: string): Promise<EstadoLeilao>
  historicoLances(leilaoId: string): Promise<LanceHistorico[]>
}

// ---------------------------------------------------------------- real

const ESCRITA = import.meta.env.VITE_COMMAND_API ?? 'http://localhost:8081'
const LEITURA = import.meta.env.VITE_QUERY_API ?? 'http://localhost:8082'

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`GET ${url} → ${r.status}`)
  return r.json() as Promise<T>
}

const apiReal: Api = {
  modo: 'real',
  async criarLeilao(req) {
    const r = await fetch(`${ESCRITA}/leiloes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
    })
    if (!r.ok) throw new Error(`POST /leiloes → ${r.status}`)
    return r.json()
  },
  async darLance(leilaoId, req) {
    const r = await fetch(`${ESCRITA}/leiloes/${leilaoId}/lances`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req),
    })
    if (r.ok) return { tipo: 'aceito', versao: (await r.json()).versao }
    if (r.status === 422) return { tipo: 'recusado' }
    if (r.status === 409) return { tipo: 'conflito' }
    return { tipo: 'erro', status: r.status }
  },
  consultarComCqrs: (id) => getJson(`${LEITURA}/leiloes/${id}`),
  // Rota de experimento no leilao-escrita: carregar(eventos) + reconstituir(). Só existe para a comparação.
  consultarSemCqrs: (id) => getJson(`${ESCRITA}/experimento/sem-cqrs/leiloes/${id}`),
  historicoLances: (id) => getJson(`${LEITURA}/leiloes/${id}/lances`),
}

// ---------------------------------------------------------------- simulado
// Imita o comportamento do backend: event store com versão otimista, projeção que
// chega atrasada (consistência eventual) e leitura sem CQRS que relê todos os eventos.
// Os tempos são artificiais: servem para testar a tela, NÃO para apresentar.

type Evento =
  | { tipo: 'LeilaoCriado'; vendedorId: string; titulo: string; precoInicial: number; incrementoMinimo: number; fimEm: string }
  | { tipo: 'LeilaoIniciado' }
  | { tipo: 'LanceRegistrado'; licitanteId: string; valor: number; criadoEm: string }

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
    if (!atual || atual.estado.versao < estado.versao) projecao.set(leilaoId, { estado, lances }) // idempotente por versão
  }, 40 + Math.random() * 80)
}

const apiSimulada: Api = {
  modo: 'simulado',
  async criarLeilao(req) {
    await rede()
    const leilaoId = crypto.randomUUID()
    eventStore.set(leilaoId, [{ tipo: 'LeilaoCriado', vendedorId: req.vendedorId, titulo: req.titulo, precoInicial: req.precoInicial, incrementoMinimo: req.incrementoMinimo, fimEm: req.fimEm }])
    projetar(leilaoId)
    setTimeout(() => { eventStore.get(leilaoId)!.push({ tipo: 'LeilaoIniciado' }); projetar(leilaoId) }, 300) // agendador
    return { leilaoId }
  },
  async darLance(leilaoId, req) {
    await rede()
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const eventos = eventStore.get(leilaoId)!
      const { estado, incrementoMinimo, vendedorId } = reconstituir(leilaoId, eventos) // carregar + reconstituir
      if (estado.status !== 'ABERTO' || req.licitanteId === vendedorId) return { tipo: 'recusado' }
      const minimo = estado.liderId ? estado.precoAtual! + incrementoMinimo : estado.precoAtual!
      if (req.valor < minimo) return { tipo: 'recusado' }
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
    return structuredClone(projecao.get(leilaoId)!.estado)       // uma linha pronta
  },
  async consultarSemCqrs(leilaoId) {
    await rede()
    const eventos = eventStore.get(leilaoId)!
    await esperar(eventos.length * CUSTO_POR_EVENTO_MS)            // relê todas as linhas
    return reconstituir(leilaoId, eventos).estado
  },
  async historicoLances(leilaoId) {
    await rede()
    return structuredClone(projecao.get(leilaoId)?.lances ?? [])
  },
}

export const api: Api = import.meta.env.VITE_MODO === 'real' ? apiReal : apiSimulada
