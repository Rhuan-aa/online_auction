// Regras puras do modo apresentação: uma seção por tela, navegada por botões ou teclado.

export type Acao = 'proxima' | 'anterior' | 'primeira' | 'ultima' | 'sair'

/** Índice válido mais próximo: a navegação para nas pontas em vez de dar a volta. */
export const limitar = (i: number, total: number) => Math.min(Math.max(i, 0), Math.max(total - 1, 0))

export function aplicar(acao: Exclude<Acao, 'sair'>, atual: number, total: number): number {
  switch (acao) {
    case 'proxima': return limitar(atual + 1, total)
    case 'anterior': return limitar(atual - 1, total)
    case 'primeira': return 0
    case 'ultima': return limitar(total - 1, total)
  }
}

const CAMPOS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])

/**
 * Qual ação uma tecla dispara. Dentro de um campo (ex.: o número de lances da corrida) as setas são do
 * campo, então só o Esc vale. Funciona com passadores de slide, que mandam setas ou PageUp/PageDown.
 */
export function acaoDaTecla(tecla: string, tagDoAlvo: string | undefined): Acao | null {
  if (tecla === 'Escape') return 'sair'
  if (tagDoAlvo && CAMPOS.has(tagDoAlvo)) return null
  switch (tecla) {
    case 'ArrowRight': case 'PageDown': return 'proxima'
    case 'ArrowLeft': case 'PageUp': return 'anterior'
    case 'Home': return 'primeira'
    case 'End': return 'ultima'
    default: return null
  }
}
