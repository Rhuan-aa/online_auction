import type { ConfiguracaoCache, EstadoLeilao, RelatorioReconstrucao } from '../../api.ts'
import { dataHora, dinheiro, ROTULO_STATUS } from '../../formato.ts'

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

export interface Passo { texto: string; ms: number; ok: boolean }

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

/** As 4 etapas da reconstrução do cache, com os números e tempos do relatório. */
/** `configuracao` é a do cache de escrita: só a C guarda cópias; nas outras, refazer não deixa cópia nenhuma. */
export function passosDaReconstrucao(r: RelatorioReconstrucao, configuracao?: ConfiguracaoCache): Passo[] {
  const atras = r.diferentes.length
  const refeitos = plural(r.refeitos, 'estado', 'estados')
  return [
    { texto: `Fotografia: ${plural(r.leiloes, 'leilão', 'leilões')}`, ms: r.tempos.fotografiaMs, ok: true },
    { texto: `Apagados: ${plural(r.chavesApagadas, 'chave', 'chaves')} do Redis e ${plural(r.checkpointsApagados, 'checkpoint', 'checkpoints')}`, ms: r.tempos.apagarMs, ok: true },
    { texto: configuracao && configuracao !== 'C' ? `Refeitos ${refeitos} (sem cópias na configuração ${configuracao})` : `Refeitos ${refeitos} a partir dos eventos`, ms: r.tempos.refazerMs, ok: true },
    atras === 0
      ? { texto: 'Idênticos ✓', ms: r.tempos.compararMs, ok: true }
      : { texto: `Cópia atrás da fonte em ${plural(atras, 'leilão', 'leilões')} — corrigida`, ms: r.tempos.compararMs, ok: false },
  ]
}

/** Preferência do sistema por menos animação. */
export const movimentoReduzido = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
