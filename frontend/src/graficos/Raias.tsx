import Moldura from './Moldura.tsx'
import { escalaLinear, marcas, rotuloNumero } from './escalas.ts'

type Resultado = 'aceito' | 'recusado' | 'conflito' | 'erro'

interface Props {
  titulo: string
  raias: { nome: string; marcas: { t: number; resultado: Resultado }[] }[]
  duracaoMs: number
}

const COR: Record<Resultado, string> = {
  aceito: 'var(--sucesso)',
  recusado: 'var(--aviso)',
  conflito: 'var(--perigo)',
  erro: 'var(--tinta-suave)',
}
const ROTULO: Record<Resultado, string> = { aceito: 'Aceito', recusado: 'Recusado', conflito: 'Conflito', erro: 'Erro' }
const ORDEM: Resultado[] = ['aceito', 'recusado', 'conflito', 'erro']

const L = 640, ME = 110, MD = 16, MT = 8, MB = 34, LINHA = 36

export default function Raias({ titulo, raias, duracaoMs }: Props) {
  const x = escalaLinear([0, Math.max(1, duracaoMs)], [ME, L - MD])
  const ticks = marcas(0, Math.max(1, duracaoMs))
  const A = MT + raias.length * LINHA + MB
  const total = raias.reduce((s, r) => s + r.marcas.length, 0)
  const resumo = `${titulo}, em ms: ${raias.map((r) => `${r.nome}, ${r.marcas.length} lances`).join('; ')}`
  const legenda = ORDEM.map((r) => ({ nome: ROTULO[r], cor: COR[r] }))

  return (
    <Moldura titulo={titulo} unidade="ms" vazio={total === 0} legenda={legenda}>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="xMidYMid meet" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={MT} y2={A - MB} className="grafico-grade" />
            <text x={x(t)} y={A - MB + 22} textAnchor="middle" className="grafico-texto">{rotuloNumero(t)}</text>
          </g>
        ))}
        {raias.map((r, i) => {
          const cy = MT + i * LINHA + LINHA / 2
          return (
            <g key={r.nome}>
              <text x={ME - 8} y={cy} textAnchor="end" dominantBaseline="middle" className="grafico-texto">{r.nome}</text>
              <line x1={ME} x2={L - MD} y1={cy} y2={cy} className="grafico-eixo" />
              {r.marcas.map((m, k) => (
                <circle key={k} cx={x(m.t)} cy={cy} r={6} className="grafico-ponto" style={{ fill: COR[m.resultado] }}>
                  <title>{`${r.nome} · ${ROTULO[m.resultado]} em ${rotuloNumero(m.t)} ms`}</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
    </Moldura>
  )
}
