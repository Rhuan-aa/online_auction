// Formatação e pequenas contas sobre as fotos da corrida (só a partir de números medidos).
import type { ArqFoto } from './tipos.ts'

const fmt = (casas: number) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
const UMA = fmt(1)
const ZERO = fmt(0)

/** 4.2 → "4,2 ms"; sem dado → "—". */
export const ms = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${UMA.format(v)} ms`)
export const inteiro = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : ZERO.format(v))
export const decimal = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : UMA.format(v))
export const pct = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : `${UMA.format(v)}%`)
export const segundos = (msTotal: number) => `${UMA.format(msTotal / 1000)} s`

/** 49152 → "48,0 KB"; acima de 1 MB, em MB. */
export function bytes(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v >= 1024 * 1024 ? `${UMA.format(v / 1024 / 1024)} MB` : `${UMA.format(v / 1024)} KB`
}

/** Tempos de escrita só existem depois da primeira amostra. */
export const temEscrita = (a: ArqFoto) => a.escrita.amostras > 0
export const temLeitura = (a: ArqFoto) => a.leitura.consultas > 0

/** % das consultas que viram uma versão velha, calculado das contagens (null sem consultas). */
export function pctDesatualizadas(a: ArqFoto): number | null {
  return temLeitura(a) ? (a.leitura.desatualizadas / a.leitura.consultas) * 100 : null
}

/** Fração de lances enviados, de 0 a 1. */
export const progresso = (a: Pick<ArqFoto, 'enviados' | 'total'>) => (a.total > 0 ? Math.min(1, a.enviados / a.total) : 0)

export function textoStatus(a: Pick<ArqFoto, 'status' | 'terminouEmMs' | 'erro'>): string {
  switch (a.status) {
    case 'rodando': return 'rodando'
    case 'terminou': return a.terminouEmMs == null ? 'terminou' : `terminou em ${segundos(a.terminouEmMs)}`
    case 'parada': return 'parada'
    case 'erro': return a.erro ? `erro: ${a.erro}` : 'erro'
  }
}
