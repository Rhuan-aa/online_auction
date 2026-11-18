import type { EstadoLeilao } from '../api.ts'
import { dataHora, dinheiro, ROTULO_STATUS } from '../formato.ts'

export interface Mudanca { campo: keyof EstadoLeilao; de: unknown; para: unknown }

/** Campos mostrados na auditoria (versao e leilaoId não entram: um é o índice, o outro nunca muda). */
const CAMPOS: (keyof EstadoLeilao)[] = ['titulo', 'status', 'precoAtual', 'liderId', 'fimEm']

/** O que mudou entre dois estados. Com `antes` nulo (versão 1), todos os campos aparecem. */
export function mudancas(antes: EstadoLeilao | null, depois: EstadoLeilao): Mudanca[] {
  return CAMPOS
    .filter((c) => antes === null || antes[c] !== depois[c])
    .map((campo) => ({ campo, de: antes ? antes[campo] : undefined, para: depois[campo] }))
}

export const ROTULO_CAMPO: Record<keyof EstadoLeilao, string> = {
  leilaoId: 'leilão', titulo: 'título', status: 'status', precoAtual: 'preço', liderId: 'líder', fimEm: 'fim', versao: 'versão',
}

/** Texto de um valor de campo, formatado conforme o campo. */
export function valorDoCampo(campo: keyof EstadoLeilao, valor: unknown): string {
  if (valor == null) return '—'
  if (campo === 'precoAtual') return dinheiro(valor as number)
  if (campo === 'fimEm') return dataHora(valor as string)
  if (campo === 'status') return ROTULO_STATUS[valor as EstadoLeilao['status']] ?? String(valor)
  return String(valor)
}

/** Preferência do sistema por menos animação. */
export const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
