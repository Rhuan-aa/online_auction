import { escalaLinear, finito, rotuloNumero } from './escalas.ts'
import { useLargura } from './useLargura.ts'

const A = 40, P = 4

/** Minigráfico sem eixos; o último valor ganha um ponto. O rótulo visível vem do contexto (tile). */
export default function Sparkline({ valores: brutos, titulo = 'Tendência', unidade }: {
  valores: number[]
  titulo?: string
  unidade?: string
}) {
  const [medida, L] = useLargura()
  const valores = brutos.filter((v) => finito(v) !== null)
  if (valores.length === 0) {
    return <span ref={medida} className="grafico-vazio" style={{ display: 'block' }}>Sem dados ainda</span>
  }
  const min = Math.min(...valores), max = Math.max(...valores)
  const x = escalaLinear([0, Math.max(1, valores.length - 1)], [P, L - P])
  const y = escalaLinear([min, max], [A - P, P])
  const ultimo = valores[valores.length - 1]
  const resumo = `${titulo}${unidade ? ` (${unidade})` : ''}: último ${rotuloNumero(ultimo)}, mínimo ${rotuloNumero(min)}, máximo ${rotuloNumero(max)}`
  return (
    <span ref={medida} style={{ display: 'block' }}>
      <svg className="grafico-spark" viewBox={`0 0 ${L} ${A}`} width="100%" height={A} role="img" aria-label={resumo}>
        <title>{resumo}</title>
        <polyline fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          style={{ stroke: 'var(--serie-a)' }} points={valores.map((v, i) => `${x(i)},${y(v)}`).join(' ')} />
        <circle cx={x(valores.length - 1)} cy={y(ultimo)} r={3} style={{ fill: 'var(--serie-a)' }} />
      </svg>
    </span>
  )
}
