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

export interface GrupoBarras { rotulo: string; valores: { serie: string; valor: number | null }[] }

/** Texto de leitor de tela das barras; grupo sem rótulo (gráfico de um grupo só) não gera ": " solto. */
export function descreverBarras(titulo: string, unidade: string, grupos: GrupoBarras[]): string {
  const partes = grupos.map((g) => {
    const valores = g.valores.map((v) => `${v.serie} ${v.valor === null ? 'sem dado' : rotuloNumero(v.valor)}`).join(', ')
    return g.rotulo ? `${g.rotulo}: ${valores}` : valores
  })
  return `${titulo}, em ${unidade}: ${partes.join('; ')}`
}

/** Mensagem do gráfico sem nada para desenhar (null: há dados). */
export function mensagemVazia(grupos: GrupoBarras[]): string | null {
  if (grupos.length === 0) return 'Sem dados ainda'
  if (grupos.every((g) => g.valores.every((v) => finito(v.valor) === null))) {
    return 'Sem medições para este gráfico nesta corrida (por exemplo, sem leitores não há consultas).'
  }
  return null
}

const PCT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** "1º de 6 · o melhor" ou "3º de 6 · 40% acima do melhor (ES + cache)". */
export function posicao(valores: { serie: string; valor: number | null }[], serie: string, sentido: 'menor' | 'maior',
  fmt: (v: number) => string): string | null {
  const validos = valores.filter((v): v is { serie: string; valor: number } => v.valor !== null)
  const ordem = [...validos].sort((a, b) => (sentido === 'menor' ? a.valor - b.valor : b.valor - a.valor))
  const i = ordem.findIndex((v) => v.serie === serie)
  if (i < 0 || ordem.length < 2) return null
  const lugar = `${i + 1}º de ${ordem.length}`
  const melhor = ordem[0]
  if (i === 0 || ordem[i].valor === melhor.valor) return `${lugar} · o melhor`
  const v = ordem[i].valor
  const dif = melhor.valor === 0 ? null : Math.abs((v - melhor.valor) / melhor.valor) * 100
  const lado = sentido === 'menor' ? 'acima' : 'abaixo'
  return dif === null
    ? `${lugar} · o melhor é ${melhor.serie} (${fmt(melhor.valor)})`
    : `${lugar} · ${PCT.format(dif)}% ${lado} do melhor, ${melhor.serie} (${fmt(melhor.valor)})`
}

