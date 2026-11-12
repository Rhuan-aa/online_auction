// Formatação para a tela. Dinheiro chega em centavos; datas, em ISO-8601.
const REAL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 12345 → "R$ 123,45". Sem valor (leilão sem lance ainda) mostra um traço. */
export const dinheiro = (centavos: number | null) => (centavos == null ? '—' : REAL.format(centavos / 100))

export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR')

/** "123,45" ou "123.45" → 12345 centavos. Devolve null se não for um valor positivo. */
export function paraCentavos(texto: string): number | null {
  const numero = Number(texto.trim().replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(numero) && numero > 0 ? Math.round(numero * 100) : null
}

/** 3725000 ms → "1h 02min 05s". Com menos de 1 min: "45s". */
export function tempoRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const dias = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const min = Math.floor((total % 3600) / 60)
  const s = total % 60
  const dois = (n: number) => String(n).padStart(2, '0')
  if (dias > 0) return `${dias}d ${dois(h)}h ${dois(min)}min`
  if (h > 0) return `${h}h ${dois(min)}min ${dois(s)}s`
  if (min > 0) return `${min}min ${dois(s)}s`
  return `${s}s`
}
