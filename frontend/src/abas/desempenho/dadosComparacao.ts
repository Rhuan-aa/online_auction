// Dados dos gráficos de uma comparação, em funções puras: configuração ausente vira barra nula.
import type { ConfiguracaoCache } from '../../api.ts'
import type { Execucao } from '../../simulacao.ts'
import type { Comparacao } from './comparacao.ts'

export const CONFIGURACOES: ConfiguracaoCache[] = ['A', 'B', 'C']
export const CORES: Record<ConfiguracaoCache, string> = { A: 'var(--serie-a)', B: 'var(--serie-b)', C: 'var(--serie-c)' }
const SERVICOS = ['escrita', 'leitura'] as const
type Servico = typeof SERVICOS[number]
type Grupos = { rotulo: string; valores: { serie: string; valor: number | null }[] }[]

const porConfiguracao = (c: Comparacao, f: (e: Execucao) => number | null | undefined) =>
  CONFIGURACOES.map((cfg) => {
    const e = c.execucoes[cfg]
    return { serie: cfg, valor: e ? f(e) ?? null : null }
  })

const porServico = (c: Comparacao, f: (e: Execucao, s: Servico) => number | null): Grupos =>
  SERVICOS.map((s) => ({ rotulo: s, valores: porConfiguracao(c, (e) => f(e, s)) }))

export function dadosComparacao(c: Comparacao) {
  const percentis = (s: Servico): Grupos =>
    (['p50', 'p95', 'p99'] as const).map((p) => ({ rotulo: p, valores: porConfiguracao(c, (e) => e[s][p]) }))
  const nomes = { redis: 'redis', checkpoint: 'checkpoint', inicio: 'início', fonte: 'fonte' } as const
  return {
    percentis: { escrita: percentis('escrita'), leitura: percentis('leitura') },
    tempoMedio: porServico(c, (e, s) => e[s].backend.tempoMedioMs),
    eventos: porServico(c, (e, s) => e[s].backend.eventosPorObtencao),
    acerto: porServico(c, (e, s) => { const a = e[s].backend.acertoCache; return a === null ? null : a * 100 }),
    origem: CONFIGURACOES.filter((cfg) => c.execucoes[cfg]).map((cfg) => {
      const e = c.execucoes[cfg]!
      return {
        rotulo: cfg,
        partes: (Object.keys(nomes) as (keyof typeof nomes)[]).map((b) => ({
          nome: nomes[b], valor: e.escrita.backend.porBase[b] + e.leitura.backend.porBase[b],
        })),
      }
    }),
    curva: CONFIGURACOES.filter((cfg) => c.execucoes[cfg]).map((cfg) => ({
      nome: cfg, cor: CORES[cfg], pontos: c.execucoes[cfg]!.grafico.escrita.map((p) => ({ x: p.versao, y: p.ms })),
    })),
  }
}
