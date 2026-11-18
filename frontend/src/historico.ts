// Histórico das comparações A × B × C, no localStorage deste navegador: serve para comparar
// as configurações lado a lado na máquina da demo. Se o localStorage falhar, segue sem histórico.
import type { Comparacao } from './abas/desempenho/comparacao.ts'
import type { Execucao, Parametros } from './simulacao.ts'

/** Entradas antigas não têm p99. */
function normalizar(e: Execucao): Execucao {
  if (!e?.escrita || !e.leitura) return e
  return { ...e, escrita: { ...e.escrita, p99: e.escrita.p99 ?? null }, leitura: { ...e.leitura, p99: e.leitura.p99 ?? null } }
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
    return Array.isArray(salvo)
      ? salvo.map((c: Comparacao) => ({ ...c, execucoes: Object.fromEntries(Object.entries(c.execucoes ?? {}).map(([k, e]) => [k, normalizar(e)])) }))
      : []
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
