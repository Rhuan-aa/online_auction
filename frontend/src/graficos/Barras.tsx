import { useState } from 'react'
import Moldura from './Moldura.tsx'
import Cartao from './Cartao.tsx'
import { descreverBarras, escalaLinear, finito, marcas, mensagemVazia, posicao, rotuloNumero, truncar } from './escalas.ts'
import { useLargura } from './useLargura.ts'

interface Props {
  titulo: string
  unidade: string
  /** Unidade de cada valor (ms, %, KB, lances/s...): aparece no eixo e no cartão ao passar o mouse. */
  simbolo: string
  grupos: { rotulo: string; valores: { serie: string; valor: number | null }[] }[]
  cores: Record<string, string>
  /** Qual lado é melhor: o cartão diz a posição e a distância até o melhor. */
  sentido?: 'menor' | 'maior'
  /** Texto do valor no cartão (padrão: número + símbolo). */
  formatar?: (v: number) => string
  /** Linha extra no cartão (ex.: o tempo convertido para segundos). */
  extra?: (v: number) => string | null
  /** Frases de "O que isso quer dizer". */
  leitura?: string[]
}

const A = 300, ME = 64, MD = 12, MT = 26, MB = 36

interface Ativo { grupo: number; serie: string }

export default function Barras({ titulo, unidade, simbolo, grupos: brutos, cores, sentido, formatar, extra, leitura }: Props) {
  const [medida, L] = useLargura()
  const [ativo, setAtivo] = useState<Ativo | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [fixo, setFixo] = useState<string | null>(null)
  const fmt = formatar ?? ((v: number) => `${rotuloNumero(v)} ${simbolo}`)
  const grupos = brutos.map((g) => ({ ...g, valores: g.valores.map((v) => ({ ...v, valor: finito(v.valor) })) }))
  const todos = grupos.flatMap((g) => g.valores.map((v) => v.valor).filter((v): v is number => v !== null))
  const ticks = marcas(0, Math.max(0, ...todos))
  const topo = ticks[ticks.length - 1] || 1
  const y = escalaLinear([0, topo], [A - MB, MT])
  const largG = (L - ME - MD) / Math.max(1, grupos.length)
  const series = [...new Set(grupos.flatMap((g) => g.valores.map((v) => v.serie)))]
  const resumo = descreverBarras(titulo, unidade, grupos)
  const destaque = ativo?.serie ?? sobre ?? fixo

  const geometria = (gi: number, j: number, n: number) => {
    const pad = largG * 0.15
    const w = (largG - pad * 2) / Math.max(1, n)
    const x = ME + gi * largG + pad + j * w
    return { x, w, cx: x + w / 2 }
  }

  return (
    <Moldura titulo={titulo} unidade={unidade} vazio={mensagemVazia(grupos) ?? false} medida={medida} leitura={leitura}
      legenda={series.map((s) => ({ nome: s, cor: cores[s] ?? 'var(--tinta-suave)' }))}
      destaque={destaque} aoDestacar={setSobre} fixo={fixo} aoFixar={(n) => setFixo((f) => (f === n ? null : n))}>
      <div className="grafico-area">
        <svg viewBox={`0 0 ${L} ${A}`} width="100%" height={A} preserveAspectRatio="xMidYMid meet" role="group" aria-label={resumo}
          onMouseLeave={() => setAtivo(null)}>
          <text x={4} y={12} className="grafico-texto grafico-texto-suave">em {simbolo}</text>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={ME} x2={L - MD} y1={y(t)} y2={y(t)} className="grafico-grade" />
              <text x={ME - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" className="grafico-texto">{rotuloNumero(t)}</text>
            </g>
          ))}
          {grupos.map((g, gi) => (
            <g key={g.rotulo || gi}>
              {g.valores.map((v, j) => {
                const { x, w, cx } = geometria(gi, j, g.valores.length)
                if (v.valor === null) {
                  return <text key={v.serie} x={cx} y={A - MB - 6} textAnchor="middle" className="grafico-texto grafico-texto-suave">—</text>
                }
                const yy = y(v.valor)
                const h = Math.max(1, A - MB - yy)
                const apagada = destaque != null && destaque !== v.serie
                return (
                  <rect key={v.serie} x={x + 1} y={yy} width={Math.max(1, w - 2)} height={h} rx={3}
                    className={`grafico-barra${apagada ? ' apagada' : ''}`} tabIndex={0}
                    aria-label={`${g.rotulo ? `${g.rotulo}, ` : ''}${v.serie}: ${fmt(v.valor)}`}
                    style={{ fill: cores[v.serie] ?? 'var(--tinta-suave)' }}
                    onMouseEnter={() => setAtivo({ grupo: gi, serie: v.serie })} onFocus={() => setAtivo({ grupo: gi, serie: v.serie })}
                    onBlur={() => setAtivo(null)} onClick={() => setFixo((f) => (f === v.serie ? null : v.serie))} />
                )
              })}
              <text x={ME + gi * largG + largG / 2} y={A - MB + 22} textAnchor="middle" className="grafico-texto">{truncar(g.rotulo, Math.floor(largG / 8))}</text>
            </g>
          ))}
          <line x1={ME} x2={L - MD} y1={A - MB} y2={A - MB} className="grafico-eixo" />
        </svg>
        {ativo && (() => {
          const g = grupos[ativo.grupo]
          const j = g?.valores.findIndex((v) => v.serie === ativo.serie) ?? -1
          const v = j >= 0 ? g.valores[j].valor : null
          if (!g || v === null) return null
          const { cx } = geometria(ativo.grupo, j, g.valores.length)
          return (
            <Cartao x={Math.min(Math.max(cx, 110), L - 110)} y={y(v)} cor={cores[ativo.serie]} nome={ativo.serie}
              grupo={g.rotulo} valor={fmt(v)} extra={extra?.(v) ?? null}
              posicao={sentido ? posicao(g.valores, ativo.serie, sentido, fmt) : null} />
          )
        })()}
      </div>
    </Moldura>
  )
}
