import Moldura from './Moldura.tsx'
import { descreverBarras, escalaLinear, finito, marcas, mensagemVazia, rotuloNumero, truncar } from './escalas.ts'
import { useLargura } from './useLargura.ts'

interface Props {
  titulo: string
  unidade: string
  /** Unidade de cada valor (ms, %, KB, lances/s...): aparece no eixo e no valor ao passar o mouse. */
  simbolo: string
  grupos: { rotulo: string; valores: { serie: string; valor: number | null }[] }[]
  cores: Record<string, string>
}

const A = 300, ME = 64, MD = 12, MT = 26, MB = 36

export default function Barras({ titulo, unidade, simbolo, grupos: brutos, cores }: Props) {
  const [medida, L] = useLargura()
  const grupos = brutos.map((g) => ({ ...g, valores: g.valores.map((v) => ({ ...v, valor: finito(v.valor) })) }))
  const todos = grupos.flatMap((g) => g.valores.map((v) => v.valor).filter((v): v is number => v !== null))
  const ticks = marcas(0, Math.max(0, ...todos))
  const topo = ticks[ticks.length - 1] || 1
  const y = escalaLinear([0, topo], [A - MB, MT])
  const largG = (L - ME - MD) / Math.max(1, grupos.length)
  const series = [...new Set(grupos.flatMap((g) => g.valores.map((v) => v.serie)))]
  const resumo = descreverBarras(titulo, unidade, grupos)

  return (
    <Moldura titulo={titulo} unidade={unidade} vazio={mensagemVazia(grupos) ?? false} medida={medida}
      legenda={series.map((s) => ({ nome: s, cor: cores[s] ?? 'var(--tinta-suave)' }))}>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="xMidYMid meet" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        <text x={4} y={12} className="grafico-texto grafico-texto-suave">em {simbolo}</text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={ME} x2={L - MD} y1={y(t)} y2={y(t)} className="grafico-grade" />
            <text x={ME - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="grafico-texto">{rotuloNumero(t)}</text>
          </g>
        ))}
        {grupos.map((g, i) => {
          const x0 = ME + i * largG
          const n = g.valores.length
          const pad = largG * 0.15
          const w = (largG - pad * 2) / Math.max(1, n)
          return (
            <g key={g.rotulo}>
              {g.valores.map((v, j) => {
                const x = x0 + pad + j * w
                const cx = x + w / 2
                if (v.valor === null) {
                  return (
                    <text key={v.serie} x={cx} y={A - MB - 6} textAnchor="middle" className="grafico-texto grafico-texto-suave">
                      <title>{`${v.serie}: sem dado`}</title>—
                    </text>
                  )
                }
                const yy = y(v.valor)
                const h = Math.max(1, A - MB - yy)
                return (
                  <rect key={v.serie} x={x + 1} y={yy} width={Math.max(1, w - 2)} height={h} rx={3}
                    style={{ fill: cores[v.serie] ?? 'var(--tinta-suave)' }}>
                    <title>{`${g.rotulo ? `${g.rotulo} · ` : ''}${v.serie}: ${rotuloNumero(v.valor)} ${simbolo}`}</title>
                  </rect>
                )
              })}
              <text x={x0 + largG / 2} y={A - MB + 22} textAnchor="middle" className="grafico-texto">{truncar(g.rotulo, Math.floor(largG / 8))}</text>
            </g>
          )
        })}
        <line x1={ME} x2={L - MD} y1={A - MB} y2={A - MB} className="grafico-eixo" />
      </svg>
    </Moldura>
  )
}
