import { useState, type MouseEvent } from 'react'
import Cartao from './Cartao.tsx'
import Moldura from './Moldura.tsx'
import { escalaLinear, finito, marcas, rotuloNumero, type Serie } from './escalas.ts'
import { useLargura } from './useLargura.ts'

interface Props {
  titulo: string
  unidade?: string
  series: Serie[]
  rotuloX: string
  rotuloY: string
  /** Texto de um valor de y no cartão (padrão: número + rotuloY). */
  formatar?: (v: number) => string
  leitura?: string[]
}

const A = 320, ME = 64, MD = 16, MT = 12, MB = 56

/**
 * Linhas interativas: ao passar o mouse, uma guia vertical marca o x mais próximo e o cartão lista o
 * valor de cada série ali (melhor primeiro). A legenda destaca uma série.
 */
export default function Linhas({ titulo, unidade, series: brutas, rotuloX, rotuloY, formatar, leitura }: Props) {
  const [medida, L] = useLargura()
  const [xAtivo, setXAtivo] = useState<number | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [fixo, setFixo] = useState<string | null>(null)
  const fmt = formatar ?? ((v: number) => `${rotuloNumero(v)} ${rotuloY}`)
  const series = brutas.map((s) => ({ ...s, pontos: s.pontos.filter((p) => finito(p.x) !== null && finito(p.y) !== null) }))
  const pts = series.flatMap((s) => s.pontos)
  const vazio = pts.length === 0
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const tx = marcas(Math.min(...xs), Math.max(...xs), 6)
  const ty = marcas(Math.min(0, ...ys), Math.max(0, ...ys))
  const x = escalaLinear([tx[0], tx[tx.length - 1]], [ME, L - MD])
  const y = escalaLinear([ty[0], ty[ty.length - 1]], [A - MB, MT])
  const resumo = `${titulo}: ${rotuloY} por ${rotuloX}. ${series.map((s) => `${s.nome}, ${s.pontos.length} pontos`).join('; ')}`
  const destaque = sobre ?? fixo
  const xsUnicos = [...new Set(xs)].sort((a, b) => a - b)

  const mover = (e: MouseEvent<SVGRectElement>) => {
    const caixa = e.currentTarget.ownerSVGElement?.getBoundingClientRect()
    if (!caixa || xsUnicos.length === 0) return
    const px = ((e.clientX - caixa.left) / caixa.width) * L
    let melhor = xsUnicos[0]
    for (const v of xsUnicos) if (Math.abs(x(v) - px) < Math.abs(x(melhor) - px)) melhor = v
    setXAtivo(melhor)
  }

  const noX = xAtivo === null ? [] : series.flatMap((s) => {
    const p = s.pontos.find((q) => q.x === xAtivo)
    return p ? [{ nome: s.nome, cor: s.cor, y: p.y }] : []
  }).sort((a, b) => a.y - b.y)

  return (
    <Moldura titulo={titulo} unidade={unidade ?? rotuloY} vazio={vazio} medida={medida} leitura={leitura}
      legenda={series.map((s) => ({ nome: s.nome, cor: s.cor }))}
      destaque={destaque} aoDestacar={setSobre} fixo={fixo} aoFixar={(n) => setFixo((f) => (f === n ? null : n))}>
      <div className="grafico-area">
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
          {xAtivo !== null && <line x1={x(xAtivo)} x2={x(xAtivo)} y1={MT} y2={A - MB} className="grafico-guia" />}
          {series.map((s) => {
            const apagada = destaque != null && destaque !== s.nome
            return (
              <g key={s.nome} className={apagada ? 'apagada' : undefined}>
                <polyline fill="none" strokeWidth={destaque === s.nome ? 4 : 2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: s.cor }}
                  points={s.pontos.map((p) => `${x(p.x)},${y(p.y)}`).join(' ')} />
                {s.pontos.map((p, i) => (
                  <circle key={i} cx={x(p.x)} cy={y(p.y)} r={p.x === xAtivo ? 6 : 4} className="grafico-ponto" style={{ fill: s.cor }} />
                ))}
              </g>
            )
          })}
          <rect x={ME} y={MT} width={Math.max(0, L - MD - ME)} height={A - MB - MT} fill="transparent"
            onMouseMove={mover} onMouseLeave={() => setXAtivo(null)} />
        </svg>
        {xAtivo !== null && noX.length > 0 && (
          <Cartao x={Math.min(Math.max(x(xAtivo), 130), L - 130)} y={y(Math.max(...noX.map((n) => n.y)))}
            nome={`${rotuloX}: ${rotuloNumero(xAtivo)}`}
            linhas={noX.map((n) => ({ nome: n.nome, cor: n.cor, valor: fmt(n.y) }))} />
        )}
      </div>
    </Moldura>
  )
}
