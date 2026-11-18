import Moldura from './Moldura.tsx'
import { escalaLinear, finito, marcas, rotuloNumero, type Serie } from './escalas.ts'
import { useLargura } from './useLargura.ts'

interface Props {
  titulo: string
  unidade?: string
  series: Serie[]
  rotuloX: string
  rotuloY: string
}

const A = 320, ME = 64, MD = 16, MT = 12, MB = 56

export default function Linhas({ titulo, unidade, series: brutas, rotuloX, rotuloY }: Props) {
  const [medida, L] = useLargura()
  const series = brutas.map((s) => ({ ...s, pontos: s.pontos.filter((p) => finito(p.x) !== null && finito(p.y) !== null) }))
  const pts = series.flatMap((s) => s.pontos)
  const vazio = pts.length === 0
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const tx = marcas(Math.min(...xs), Math.max(...xs), 6)
  const ty = marcas(Math.min(0, ...ys), Math.max(0, ...ys))
  const x = escalaLinear([tx[0], tx[tx.length - 1]], [ME, L - MD])
  const y = escalaLinear([ty[0], ty[ty.length - 1]], [A - MB, MT])
  const resumo = `${titulo}: ${rotuloY} por ${rotuloX}. ${series.map((s) => `${s.nome}, ${s.pontos.length} pontos`).join('; ')}`

  return (
    <Moldura titulo={titulo} unidade={unidade ?? rotuloY} vazio={vazio} medida={medida} legenda={series.map((s) => ({ nome: s.nome, cor: s.cor }))}>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="xMidYMid meet" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        {ty.map((t) => (
          <g key={t}>
            <line x1={ME} x2={L - MD} y1={y(t)} y2={y(t)} className="grafico-grade" />
            <text x={ME - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="grafico-texto">{rotuloNumero(t)}</text>
          </g>
        ))}
        {tx.map((t) => (
          <text key={t} x={x(t)} y={A - MB + 20} textAnchor="middle" className="grafico-texto">{rotuloNumero(t)}</text>
        ))}
        <text x={(ME + L - MD) / 2} y={A - 8} textAnchor="middle" className="grafico-texto grafico-texto-suave">{rotuloX}</text>
        {series.map((s) => (
          <g key={s.nome}>
            <polyline fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: s.cor }}
              points={s.pontos.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} />
            {s.pontos.map((p, i) => (
              <circle key={i} cx={x(p.x)} cy={y(p.y)} r={4} className="grafico-ponto" style={{ fill: s.cor }}>
                <title>{`${s.nome}: ${rotuloNumero(p.y)} ${rotuloY} (${rotuloX} ${rotuloNumero(p.x)})`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </Moldura>
  )
}
