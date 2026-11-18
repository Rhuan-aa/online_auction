import Moldura from './Moldura.tsx'
import { escalaLinear, marcas, rotuloNumero } from './escalas.ts'

interface Props {
  titulo: string
  unidade: string
  itens: { rotulo: string; partes: { nome: string; valor: number }[] }[]
}

// cor por ordem de primeira aparição do nome, nunca por tamanho
const PALETA = ['var(--serie-a)', 'var(--serie-b)', 'var(--serie-c)', 'var(--tinta-suave)']

const L = 640, ME = 110, MD = 16, MT = 8, MB = 34, LINHA = 40

export default function BarrasEmpilhadas({ titulo, unidade, itens }: Props) {
  const nomes = [...new Set(itens.flatMap((i) => i.partes.map((p) => p.nome)))]
  const cor = (n: string) => PALETA[nomes.indexOf(n) % PALETA.length]
  const totais = itens.map((i) => i.partes.reduce((s, p) => s + Math.max(0, p.valor), 0))
  const ticks = marcas(0, Math.max(0, ...totais))
  const topo = ticks[ticks.length - 1] || 1
  const x = escalaLinear([0, topo], [ME, L - MD])
  const A = MT + itens.length * LINHA + MB
  const resumo = `${titulo}, em ${unidade}: ${itens.map((i) => `${i.rotulo}: ${i.partes.map((p) => `${p.nome} ${rotuloNumero(p.valor)}`).join(', ')}`).join('; ')}`

  return (
    <Moldura titulo={titulo} unidade={unidade} vazio={itens.length === 0}
      legenda={nomes.map((n) => ({ nome: n, cor: cor(n) }))}>
      <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="xMidYMid meet" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={MT} y2={A - MB} className="grafico-grade" />
            <text x={x(t)} y={A - MB + 22} textAnchor="middle" className="grafico-texto">{rotuloNumero(t)}</text>
          </g>
        ))}
        {itens.map((it, i) => {
          const yy = MT + i * LINHA + 6
          let acc = 0
          return (
            <g key={it.rotulo}>
              <text x={ME - 8} y={yy + 14} textAnchor="end" dominantBaseline="middle" className="grafico-texto">{it.rotulo}</text>
              {it.partes.filter((p) => p.valor > 0).map((p) => {
                const x0 = x(acc)
                acc += p.valor
                return (
                  <rect key={p.nome} x={x0} y={yy} width={Math.max(1, x(acc) - x0)} height={28} className="grafico-segmento"
                    style={{ fill: cor(p.nome) }}>
                    <title>{`${it.rotulo} · ${p.nome}: ${rotuloNumero(p.valor)} ${unidade}`}</title>
                  </rect>
                )
              })}
            </g>
          )
        })}
      </svg>
    </Moldura>
  )
}
