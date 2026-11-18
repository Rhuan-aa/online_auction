// O caminho de um lance pelo sistema e as duas medições reais: gravação (clique → resposta do POST) e
// propagação (resposta → chegada do SSE). Nada é medido por nó intermediário.
export const NOS = ['front', 'escrita', 'eventstore', 'kafka', 'leitura', 'agendador', 'sse'] as const
export type No = (typeof NOS)[number]

export interface Medicao { versao: number; cliqueEm: number; respostaEm: number | null; sseEm: number | null }

/** Marca a chegada do SSE na medição de mesma versão (a primeira chegada vale; repetições não mexem). */
export function casarSse(pendentes: Medicao[], versaoSse: number, quando: number): Medicao[] {
  return pendentes.map((m) => (m.versao === versaoSse && m.sseEm === null ? { ...m, sseEm: quando } : m))
}

export function trechos(m: Medicao): { gravacaoMs: number | null; propagacaoMs: number | null } {
  const gravacaoMs = m.respostaEm === null ? null : Math.max(0, m.respostaEm - m.cliqueEm)
  // o SSE pode chegar um instante antes da resposta do POST: o trecho nunca fica negativo
  const propagacaoMs = m.respostaEm === null || m.sseEm === null ? null : Math.max(0, m.sseEm - m.respostaEm)
  return { gravacaoMs, propagacaoMs }
}

/** gravando = POST em voo; gravado = POST aceito, SSE ainda não chegou; completo = SSE do próprio lance; externo = lance de outra janela. */
export type Fase = 'gravando' | 'gravado' | 'completo' | 'externo'

export const PASSO_MS = 150

const ESCRITA = ['front', 'front>escrita', 'escrita', 'escrita>eventstore', 'eventstore']
const EXTERNO = ['kafka>leitura', 'leitura', 'leitura>sse', 'sse', 'sse>front', 'front']
const PROPAGACAO = ['eventstore>kafka', 'kafka', ...EXTERNO]

/** Elemento aceso → índice do passo; o CSS atrasa cada um em passo × 150 ms. O ramo do agendador acende junto de kafka→leitura. */
export function luzDoCaminho(fase: Fase | null): Record<string, number> {
  if (!fase) return {}
  const luz: Record<string, number> = {}
  const acender = (ids: string[], inicio: number) => ids.forEach((id, i) => { luz[id] ??= inicio + i })
  if (fase === 'externo') { acender(['kafka', ...EXTERNO], 0); return luz } // sem o agendador: só os lances desta janela o acendem
  acender(ESCRITA, 0)
  if (fase === 'completo') {
    acender(PROPAGACAO, ESCRITA.length)
    luz['kafka>agendador'] = luz['kafka>leitura']
    luz.agendador = luz.leitura
  }
  return luz
}
