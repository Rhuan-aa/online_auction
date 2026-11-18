// Placar: os critérios numéricos, o sentido de cada um e quem venceu cada coluna.
import { bytes, decimal, ms, pct, pctDesatualizadas, temEscrita, temLeitura } from './medidas.ts'
import type { ArqFoto } from './tipos.ts'

export type Sentido = 'menor' | 'maior'

/** Índices dos melhores valores (empates contam todos); null é ignorado; sem nenhum valor, conjunto vazio. */
export function melhores(valores: (number | null)[], sentido: Sentido): Set<number> {
  const validos = valores.filter((v): v is number => v !== null && Number.isFinite(v))
  if (validos.length === 0) return new Set()
  const alvo = sentido === 'menor' ? Math.min(...validos) : Math.max(...validos)
  return new Set(valores.flatMap((v, i) => (v === alvo ? [i] : [])))
}

export interface Criterio {
  id: string
  rotulo: string
  sentido: Sentido
  valor: (a: ArqFoto) => number | null
  texto: (a: ArqFoto) => string
}

const escrita = (k: 'p50' | 'p95') => (a: ArqFoto) => (temEscrita(a) ? a.escrita[k] : null)
const consulta = (a: ArqFoto) => (temLeitura(a) ? a.leitura.p50 : null)
const espaco = (a: ArqFoto) => a.espaco?.bytes ?? null

export const CRITERIOS: Criterio[] = [
  { id: 'tipico', rotulo: 'Tempo típico de registro', sentido: 'menor', valor: escrita('p50'), texto: (a) => ms(escrita('p50')(a)) },
  { id: 'pior', rotulo: 'Pior caso', sentido: 'menor', valor: escrita('p95'), texto: (a) => ms(escrita('p95')(a)) },
  { id: 'vazao', rotulo: 'Lances/s', sentido: 'maior', valor: (a) => a.lancesPorSegundo, texto: (a) => decimal(a.lancesPorSegundo) },
  { id: 'consulta', rotulo: 'Consulta (típico)', sentido: 'menor', valor: consulta, texto: (a) => ms(consulta(a)) },
  { id: 'desatualizadas', rotulo: 'Leituras desatualizadas', sentido: 'menor', valor: pctDesatualizadas, texto: (a) => pct(pctDesatualizadas(a)) },
  { id: 'operacoes', rotulo: 'Operações por lance', sentido: 'menor', valor: (a) => a.operacoes.porLance, texto: (a) => decimal(a.operacoes.porLance) },
  { id: 'espaco', rotulo: 'Espaço', sentido: 'menor', valor: espaco, texto: (a) => bytes(espaco(a)) },
]

/** Vencedores de cada critério: id do critério → índices das arquiteturas. */
export function vencedores(arqs: ArqFoto[]): Record<string, Set<number>> {
  return Object.fromEntries(CRITERIOS.map((c) => [c.id, melhores(arqs.map(c.valor), c.sentido)]))
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** Texto do tooltip de integridade: o que deu errado, ou por que está certo. */
export function detalheIntegridade(i: NonNullable<ArqFoto['integridade']>): string {
  const problemas = [
    i.lancesPerdidos > 0 ? plural(i.lancesPerdidos, 'lance perdido', 'lances perdidos') : null,
    i.umVencedor ? null : 'não terminou com exatamente um vencedor',
    i.precoFinalCorreto ? null : 'preço final diferente do maior lance aceito',
  ].filter((p): p is string => p !== null)
  const base = problemas.length > 0 ? problemas.join('; ') : 'Um vencedor, preço final correto e nenhum lance perdido'
  return i.detalhe ? `${base}. ${i.detalhe}` : base
}
