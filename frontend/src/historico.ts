// Histórico das execuções do painel de ADM, no localStorage deste navegador: serve para comparar
// A, B e C lado a lado na máquina da demo. Se o localStorage falhar, o painel segue sem histórico.
import type { Comparacao } from './abas/desempenho/comparacao.ts'
import type { Execucao, Parametros } from './simulacao.ts'

const CHAVE = 'leilao.adm.historico'
export const MAXIMO_HISTORICO = 20

/** Mais recente primeiro. */
export function carregarHistorico(): Execucao[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? '[]')
    return Array.isArray(salvo) ? salvo : []
  } catch {
    return []
  }
}

export function salvarHistorico(execucoes: Execucao[]): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(execucoes.slice(0, MAXIMO_HISTORICO)))
  } catch {
  }
}

/** Mesmos parâmetros e semente = mesma simulação: a comparação justa entre configurações. */
export function chaveSimulacao(p: Parametros): string {
  return [p.licitantes, p.lancesPorLicitante, p.simultaneos, p.precoInicial, p.incrementoMin,
    p.incrementoMax, p.leitores, p.semente, p.acompanharPreco ? 1 : 0].join('|')
}

/** Rótulo curto da simulação: "20×10 · 6 simult. · 4 leit. · semente 42 · acompanha o preço". */
export function rotuloSimulacao(p: Parametros): string {
  return `${p.licitantes}×${p.lancesPorLicitante} · ${p.simultaneos} simult. · ${p.leitores} leit. · semente ${p.semente}`
    + (p.acompanharPreco ? ' · acompanha o preço' : '')
}

const CHAVE_COMPARACOES = 'leilao.adm.comparacoes'
export const MAXIMO_COMPARACOES = 10

/** Mais recente primeiro. */
export function carregarComparacoes(): Comparacao[] {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE_COMPARACOES) ?? '[]')
    return Array.isArray(salvo) ? salvo : []
  } catch {
    return []
  }
}

export function salvarComparacoes(comparacoes: Comparacao[]): void {
  try {
    localStorage.setItem(CHAVE_COMPARACOES, JSON.stringify(comparacoes.slice(0, MAXIMO_COMPARACOES)))
  } catch {
  }
}
