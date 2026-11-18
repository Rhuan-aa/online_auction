// Métricas do backend para o painel de ADM (docs/PAINEL_ADM.md, seção 3): lê /actuator/metrics
// da escrita (8081) e da leitura (8082), descobre a configuração ativa (A/B/C) e calcula quanto
// uma execução custou como a diferença entre uma foto de antes e outra de depois.
import type { Api, Metrica, Servico } from './api.ts'

export const BASES = ['redis', 'checkpoint', 'inicio', 'fonte'] as const
export type Base = typeof BASES[number]

interface Acumulado { count: number; total: number }

export interface Foto { obter: Acumulado; bases: Record<Base, Acumulado> }

export interface ResumoBackend {
  obtencoes: number
  tempoMedioMs: number | null
  eventosPorObtencao: number | null
  acertoCache: number | null
  porBase: Record<Base, number>
}

function medida(m: Metrica, estatistica: string): number {
  return m.measurements.find((x) => x.statistic === estatistica)?.value ?? 0
}

function acumulado(m: Metrica): Acumulado {
  return { count: medida(m, 'COUNT'), total: medida(m, 'TOTAL_TIME') || medida(m, 'TOTAL') }
}

function configuracaoDe(m: Metrica): string | null {
  return m.availableTags.find((t) => t.tag === 'configuracao')?.values[0] ?? null
}

export function diferenca(antes: Foto, depois: Foto): ResumoBackend {
  const obtencoes = depois.obter.count - antes.obter.count
  const tempo = depois.obter.total - antes.obter.total
  const porBase = {} as Record<Base, number>
  let pedidos = 0
  let eventos = 0
  for (const b of BASES) {
    porBase[b] = depois.bases[b].count - antes.bases[b].count
    pedidos += porBase[b]
    eventos += depois.bases[b].total - antes.bases[b].total
  }
  return {
    obtencoes,
    tempoMedioMs: obtencoes > 0 ? (tempo / obtencoes) * 1000 : null,
    eventosPorObtencao: pedidos > 0 ? eventos / pedidos : null,
    acertoCache: pedidos > 0 ? porBase.redis / pedidos : null,
    porBase,
  }
}

const CAMINHO: Record<Servico, string> = { escrita: 'comando', leitura: 'consulta' }

async function fotografar(api: Api, servico: Servico): Promise<Foto> {
  const [obter, ...bases] = await Promise.all([
    api.lerMetrica(servico, 'leilao.estado.obter', [`caminho:${CAMINHO[servico]}`]),
    ...BASES.map((b) => api.lerMetrica(servico, 'leilao.estado.eventos.lidos', [`base:${b}`])),
  ])
  return {
    obter: acumulado(obter),
    bases: Object.fromEntries(BASES.map((b, i) => [b, acumulado(bases[i])])) as Record<Base, Acumulado>,
  }
}

export async function fotografarServicos(api: Api): Promise<Record<Servico, Foto>> {
  return { escrita: await fotografar(api, 'escrita'), leitura: await fotografar(api, 'leitura') }
}

export async function lerConfiguracao(api: Api): Promise<Record<Servico, string | null>> {
  const ler = (s: Servico) => api.lerMetrica(s, 'leilao.estado.obter').then(configuracaoDe).catch(() => null)
  const [escrita, leitura] = await Promise.all([ler('escrita'), ler('leitura')])
  return { escrita, leitura }
}

/**
 * Depois dos lances, o ouvinte Kafka da leitura ainda obtém o estado (uma vez por evento). Espera a
 * contagem da leitura parar de mudar (leituras a cada 500 ms, no máximo 5 s) antes da foto final.
 */
export async function esperarLeituraAssentar(api: Api): Promise<void> {
  let anterior = -1
  for (const fim = Date.now() + 5_000; Date.now() < fim;) {
    const atual = (await fotografar(api, 'leitura')).obter.count
    if (atual === anterior) return
    anterior = atual
    await new Promise((ok) => setTimeout(ok, 500))
  }
}
