// Regras puras do mini leilão: dois licitantes (Ana e Bruno) disputando um leilão real de prazo curto.
import type { EstadoLeilao, Notificacao } from '../api.ts'

export const LICITANTES = [
  { id: 'ana', nome: 'Ana' },
  { id: 'bruno', nome: 'Bruno' },
] as const

export const VENDEDOR_MINI = 'vendedor-mini'
export const PRAZO_MINI_MS = 30_000
export const PRECO_INICIAL = 10_000
export const INCREMENTO = 500

export const nomeDe = (id: string | null) => LICITANTES.find((l) => l.id === id)?.nome ?? id ?? '—'

export type SituacaoLicitante = 'sem-lance' | 'ganhando' | 'superado' | 'venceu' | 'perdeu' | 'fora'

/** Como cada tela se vê: depende de quem lidera e de a pessoa já ter dado lance neste leilão. */
export function situacaoDe(e: EstadoLeilao | null, id: string, deuLance: boolean): SituacaoLicitante {
  if (!e) return 'sem-lance'
  if (e.status === 'ENCERRADO') return e.liderId === id ? 'venceu' : deuLance ? 'perdeu' : 'fora'
  if (e.liderId === id) return 'ganhando'
  return deuLance ? 'superado' : 'sem-lance'
}

export const ROTULO_SITUACAO: Record<SituacaoLicitante, string> = {
  'sem-lance': 'Ainda sem lance',
  ganhando: 'Você está ganhando',
  superado: 'Você foi superado',
  venceu: 'Você venceu!',
  perdeu: 'Não foi dessa vez',
  fora: 'Não participou',
}

/** Valor do próximo lance: o preço inicial se ninguém deu lance, senão o atual mais o incremento. */
export const valorDoLance = (e: EstadoLeilao) => (e.liderId === null ? PRECO_INICIAL : (e.precoAtual ?? PRECO_INICIAL) + INCREMENTO)

/**
 * O único aviso que a tela mostra: o último deste leilão, e só enquanto ainda vale. "Superado" some assim que a
 * pessoa volta a liderar (e fica se ela perdeu no fim); "venceu" fica para quem venceu.
 */
export function avisoAtual(lista: Notificacao[], leilaoId: string | null, situacao: SituacaoLicitante): Notificacao | null {
  const ultimo = lista.filter((n) => n.leilaoId === leilaoId).at(-1)
  if (!ultimo) return null
  if (ultimo.tipo === 'SUPERADO') return situacao === 'superado' || situacao === 'perdeu' ? ultimo : null
  if (ultimo.tipo === 'VENCEU') return situacao === 'venceu' ? ultimo : null
  return null
}
