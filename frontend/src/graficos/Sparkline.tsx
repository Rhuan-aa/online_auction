import { escalaLinear, rotuloNumero } from './escalas.ts'

const L = 160, A = 40, P = 4

/** Minigráfico sem eixos; o último valor ganha um ponto. O rótulo visível vem do contexto (tile). */
export default function Sparkline({ valores, titulo = 'Tendência', unidade }: {
  valores: number[]
  titulo?: string
  unidade?: string
}) {
  if (valores.length === 0) return <span className="grafico-vazio">Sem dados ainda</span>
  const min = Math.min(...valores), max = Math.max(...valores)
  const x = escalaLinear([0, Math.max(1, valores.length - 1)], [P, L - P])
  const y = escalaLinear([min, max], [A - P, P])
  const ultimo = valores[valores.length - 1]
  const resumo = `${titulo}${unidade ? ` (${unidade})` : ''}: último ${rotuloNumero(ultimo)}, mínimo ${rotuloNumero(min)}, máximo ${rotuloNumero(max)}`
  return (
    <svg className="grafico-spark" viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="none" role="img" aria-label={resumo}>
      <title>{resumo}</title>
      <polyline fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        style={{ stroke: 'var(--serie-a)' }} points={valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
      <circle cx={x(valores.length - 1)} cy={y(ultimo)} r={3} style={{ fill: 'var(--serie-a)' }} />
    </svg>
  )
}
