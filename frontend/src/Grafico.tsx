// Gráfico de linhas em SVG, sem biblioteca: tempo (ms) × nº de eventos do leilão, uma linha por
// configuração. Legenda, rótulo direto no fim de cada linha e dica ao passar o mouse.
import { useRef, useState, type PointerEvent } from 'react'
import type { Ponto } from './simulacao.ts'

export interface Serie { nome: string; classe: string; pontos: Ponto[] }

const L = 640
const A = 260
const M = { cima: 14, direita: 40, baixo: 34, esquerda: 52 }

/** Arredonda o topo do eixo para 1, 2 ou 5 × 10^n. */
function topoBonito(v: number): number {
  if (v <= 0) return 1
  const ordem = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 5, 10].find((f) => f * ordem >= v) ?? 10) * ordem
}

export default function Grafico({ series, titulo }: { series: Serie[]; titulo: string }) {
  const svg = useRef<SVGSVGElement>(null)
  const [versaoMouse, setVersaoMouse] = useState<number | null>(null)

  const comPontos = series.filter((s) => s.pontos.length > 0)
  if (comPontos.length === 0) return <p className="suave">Sem amostras para o gráfico.</p>

  const todos = comPontos.flatMap((s) => s.pontos)
  const maxX = Math.max(1, ...todos.map((p) => p.versao))
  const maxY = topoBonito(Math.max(...todos.map((p) => p.ms)))
  const x = (v: number) => M.esquerda + (v / maxX) * (L - M.esquerda - M.direita)
  const y = (ms: number) => A - M.baixo - (ms / maxY) * (A - M.cima - M.baixo)
  const marcasY = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY)
  const marcasX = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxX))

  function aoMover(e: PointerEvent<SVGSVGElement>) {
    const caixa = svg.current?.getBoundingClientRect()
    if (!caixa) return
    const px = ((e.clientX - caixa.left) / caixa.width) * L
    const v = ((px - M.esquerda) / (L - M.esquerda - M.direita)) * maxX
    setVersaoMouse(v < 0 || v > maxX ? null : v)
  }

  // Para a dica: o ponto de cada série mais perto da versão sob o mouse.
  const maisPerto = (s: Serie) =>
    s.pontos.reduce((m, p) => (Math.abs(p.versao - versaoMouse!) < Math.abs(m.versao - versaoMouse!) ? p : m))

  return (
    <figure className="grafico">
      <figcaption>
        <span>{titulo}</span>
        <span className="legenda">
          {comPontos.map((s) => <span key={s.nome} className={s.classe}><i aria-hidden="true" />{s.nome}</span>)}
        </span>
      </figcaption>
      <div className="grafico-area">
        <svg
          ref={svg} viewBox={`0 0 ${L} ${A}`} role="img"
          aria-label={`${titulo}. Eixo x: nº de eventos do leilão; eixo y: milissegundos.`}
          onPointerMove={aoMover} onPointerLeave={() => setVersaoMouse(null)}
        >
          {marcasY.map((ms) => (
            <g key={ms}>
              <line className="grade" x1={M.esquerda} x2={L - M.direita} y1={y(ms)} y2={y(ms)} />
              <text className="eixo" x={M.esquerda - 8} y={y(ms) + 4} textAnchor="end">{ms.toLocaleString('pt-BR')}</text>
            </g>
          ))}
          {marcasX.map((v) => (
            <text key={v} className="eixo" x={x(v)} y={A - M.baixo + 18} textAnchor="middle">{v}</text>
          ))}
          <text className="eixo" x={L - M.direita} y={A - 4} textAnchor="end">nº de eventos do leilão</text>
          <text className="eixo" x={8} y={M.cima} >ms</text>

          {versaoMouse !== null && (
            <line className="mira" x1={x(versaoMouse)} x2={x(versaoMouse)} y1={M.cima} y2={A - M.baixo} />
          )}
          {comPontos.map((s) => {
            const ultimo = s.pontos[s.pontos.length - 1]
            return (
              <g key={s.nome} className={s.classe}>
                <polyline className="linha" points={s.pontos.map((p) => `${x(p.versao)},${y(p.ms)}`).join(' ')} />
                {versaoMouse !== null && (() => {
                  const p = maisPerto(s)
                  return <circle className="ponto" cx={x(p.versao)} cy={y(p.ms)} r={4} />
                })()}
                <text className="rotulo" x={x(ultimo.versao) + 8} y={y(ultimo.ms) + 4}>{s.nome}</text>
              </g>
            )
          })}
        </svg>
        {versaoMouse !== null && (
          <div className="dica" style={{ left: `${(x(versaoMouse) / L) * 100}%` }}>
            {comPontos.map((s) => {
              const p = maisPerto(s)
              return <div key={s.nome} className={s.classe}><i aria-hidden="true" />{s.nome}: <strong>{p.ms.toFixed(1)} ms</strong> <span className="suave">(≈{p.versao} eventos)</span></div>
            })}
          </div>
        )}
      </div>
    </figure>
  )
}
