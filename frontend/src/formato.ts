// Formatação para a tela. Dinheiro chega em centavos; datas, em ISO-8601.
const REAL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** 12345 → "R$ 123,45". Sem valor (leilão sem lance ainda) mostra um traço. */
export const dinheiro = (centavos: number | null) => (centavos == null ? '—' : REAL.format(centavos / 100))

export const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR')
