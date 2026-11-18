export interface Serie {
  nome: string
  cor: string
  pontos: { x: number; y: number }[]
}

/** Mapeia linearmente `dominio` em `faixa`. Domínio degenerado cai no meio da faixa. */
export function escalaLinear(dominio: [number, number], faixa: [number, number]): (v: number) => number {
  const [d0, d1] = dominio
  const [f0, f1] = faixa
  if (d0 === d1) return () => (f0 + f1) / 2
  return (v) => f0 + ((v - d0) / (d1 - d0)) * (f1 - f0)
}

/** Passo "redondo" (1, 2 ou 5 × 10ⁿ) mais próximo de `bruto`, arredondando para cima. */
function passoRedondo(bruto: number): number {
  const exp = Math.floor(Math.log10(bruto))
  const base = 10 ** exp
  const f = bruto / base
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return m * base
}

/** Valores redondos cobrindo [min, max], em torno de `alvo` marcas. */
export function marcas(min: number, max: number, alvo = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0]
  if (max < min) [min, max] = [max, min]
  if (min === max) return [min]
  const passo = passoRedondo((max - min) / alvo)
  const ini = Math.floor(min / passo + 1e-9)
  const fim = Math.ceil(max / passo - 1e-9)
  const out: number[] = []
  for (let i = ini; i <= fim; i++) out.push(Number((i * passo).toPrecision(12)))
  return out
}

/** Rótulo curto para eixos: 12 mil / 3,4 mi. */
export function rotuloNumero(v: number): string {
  const a = Math.abs(v)
  if (a >= 1e6) return `${(v / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (a >= 1e4) return `${(v / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
}

/** Número utilizável (finito) ou null. */
export function finito(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/** Corta o texto com reticências para caber em `max` caracteres; '' se não houver espaço. */
export function truncar(txt: string, max: number): string {
  if (txt.length <= max) return txt
  if (max < 2) return ''
  return `${txt.slice(0, max - 1)}…`
}

/** Domínio x das raias: a última marca redonda, sempre >= duracaoMs. */
export function dominioRaias(duracaoMs: number): number {
  const m = marcas(0, Math.max(1, duracaoMs))
  return m[m.length - 1]
}
