// Estado da aba: só a tentativa em curso é exibida; as medições antigas servem apenas para casar o SSE.
import { casarSse, trechos, type Fase, type Medicao } from './caminho.ts'

const MAX_MEDICOES = 10

interface Tentativa {
  cliqueEm: number
  situacao: 'gravando' | 'recusada' | 'aceita'
  mensagem?: string
  versao?: number
  expirou: boolean
}
export interface EstadoAba { medicoes: Medicao[]; tentativa: Tentativa | null; externoEm: number | null }

export type Acao =
  | { tipo: 'clique'; em: number }
  | { tipo: 'aceito'; versao: number; respostaEm: number; sseEm: number | null } // sseEm: SSE que chegou antes da resposta
  | { tipo: 'recusado'; mensagem: string }
  | { tipo: 'sse'; versao: number; quando: number }
  | { tipo: 'expirou'; versao: number }

export const INICIAL: EstadoAba = { medicoes: [], tentativa: null, externoEm: null }

export function reduzir(s: EstadoAba, a: Acao): EstadoAba {
  switch (a.tipo) {
    case 'clique':
      return { ...s, tentativa: { cliqueEm: a.em, situacao: 'gravando', expirou: false }, externoEm: null }
    case 'recusado':
      return s.tentativa ? { ...s, tentativa: { ...s.tentativa, situacao: 'recusada', mensagem: a.mensagem } } : s
    case 'aceito': {
      if (!s.tentativa) return s
      const m: Medicao = { versao: a.versao, cliqueEm: s.tentativa.cliqueEm, respostaEm: a.respostaEm, sseEm: a.sseEm }
      return {
        medicoes: [...s.medicoes, m].slice(-MAX_MEDICOES),
        tentativa: { ...s.tentativa, situacao: 'aceita', versao: a.versao },
        externoEm: a.sseEm !== null ? null : s.externoEm,
      }
    }
    case 'sse': {
      if (s.medicoes.some((m) => m.versao === a.versao && m.sseEm === null)) {
        return { ...s, medicoes: casarSse(s.medicoes, a.versao, a.quando), externoEm: null }
      }
      if (s.medicoes.some((m) => m.versao === a.versao)) return s // repetição de um lance já medido
      return { ...s, externoEm: a.quando }
    }
    case 'expirou':
      return s.tentativa?.versao === a.versao ? { ...s, tentativa: { ...s.tentativa, expirou: true } } : s
  }
}

interface Visao { fase: Fase | null; gravacaoMs: number | null; propagacaoMs: number | null; mensagem: string | null; nota: string | null }

export function visao(s: EstadoAba): Visao {
  const t = s.tentativa
  const v: Visao = { fase: null, gravacaoMs: null, propagacaoMs: null, mensagem: null, nota: null }
  if (t?.situacao === 'gravando') return { ...v, fase: 'gravando' }
  const m = t?.situacao === 'aceita' ? s.medicoes.find((x) => x.versao === t.versao) : undefined
  const ref = m ? (m.sseEm ?? m.respostaEm ?? m.cliqueEm) : t ? t.cliqueEm : 0
  if (t?.situacao === 'recusada') v.mensagem = t.mensagem ?? null
  if (s.externoEm !== null && s.externoEm > ref) return { ...v, fase: 'externo' }
  if (!m || !t) return v
  const tr = trechos(m)
  return {
    ...v, ...tr,
    fase: m.sseEm !== null ? 'completo' : 'gravado',
    nota: m.sseEm !== null && m.respostaEm !== null && m.sseEm < m.respostaEm ? 'SSE chegou antes da resposta do POST'
      : m.sseEm === null && t.expirou ? 'SSE não chegou em 5 s' : null,
  }
}
