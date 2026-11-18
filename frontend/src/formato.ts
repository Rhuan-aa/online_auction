// Formatação para a tela. Dinheiro chega em centavos; datas, em ISO-8601.
const REAL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 12345 → "R$ 123,45". Sem valor (leilão sem lance ainda) mostra um traço. */
export const dinheiro = (centavos: number | null) => (centavos == null ? '—' : REAL.format(centavos / 100))

export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR')

/**
 * Texto de dinheiro → centavos. Aceita o formato brasileiro ("1.234,56", "100,5", "R$ 10") e o ponto como
 * decimal quando não há vírgula ("123.45"). No máximo 2 casas. Devolve null se não for um valor positivo.
 */
export function paraCentavos(texto: string): number | null {
  const t = texto.trim().replace(/^R\$\s*/, '')
  const br = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t)
  const ponto = br ? null : /^(\d+)\.(\d{1,2})$/.exec(t)
  const m = br ?? ponto
  if (!m) return null
  const reais = Number(m[1].replace(/\./g, ''))
  const centavos = Number((m[2] ?? '').padEnd(2, '0'))
  const total = reais * 100 + centavos
  return Number.isSafeInteger(total) && total > 0 ? total : null
}

export const ROTULO_STATUS = {
  CRIADO: 'Agendado',
  ABERTO: 'Aberto',
  ENCERRADO: 'Encerrado',
  CANCELADO: 'Cancelado',
} as const
