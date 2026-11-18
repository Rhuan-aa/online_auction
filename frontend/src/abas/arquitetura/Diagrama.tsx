import type { CSSProperties, RefObject } from 'react'
import { useLargura } from '../../graficos/useLargura.ts'
import { PASSO_MS, type No } from './caminho.ts'

const LARGURA_MIN = 950 // 5 colunas de 190 px: nó de 150 px e 40 px para a seta
const NO_L = 150
const NO_A = 60
const ROTULOS: Record<No, [string, string]> = {
  front: ['Front', 'React'],
  escrita: ['leilao-escrita', ':8081'],
  eventstore: ['Event Store', 'PostgreSQL'],
  kafka: ['Kafka', 'leilao.eventos'],
  agendador: ['agendador-leilao', ':8084'],
  leitura: ['leilao-leitura', ':8082'],
  sse: ['SSE', 'push ao navegador'],
}
// coluna e linha de cada nó (5 colunas × 2 linhas)
const POS: Record<No, [number, number]> = {
  front: [0, 0], escrita: [1, 0], eventstore: [2, 0], kafka: [3, 0], agendador: [4, 0], sse: [0, 1], leitura: [3, 1],
}
const ARESTAS: [No, No][] = [
  ['front', 'escrita'], ['escrita', 'eventstore'], ['eventstore', 'kafka'], ['kafka', 'leitura'],
  ['kafka', 'agendador'], ['leitura', 'sse'], ['sse', 'front'],
]

interface Props {
  chave: string // muda a cada tentativa: o SVG é remontado e a animação recomeça
  luz: Record<string, number> // elemento → passo em que acende
  gravacaoMs: number | null
  propagacaoMs: number | null
}

export default function Diagrama({ chave, luz, gravacaoMs, propagacaoMs }: Props) {
  const [ref, medida] = useLargura()
  const W = Math.max(medida, LARGURA_MIN)
  const H = 290
  const centro = (n: No) => ({ x: (W / 5) * (POS[n][0] + 0.5), y: 70 + POS[n][1] * 130 })
  const estilo = (id: string) => ({ '--atraso': `${(luz[id] ?? 0) * PASSO_MS}ms` }) as CSSProperties

  function aresta(de: No, para: No) {
    const a = centro(de), b = centro(para)
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.hypot(dx, dy)
    const t = Math.min(NO_L / 2 / (Math.abs(dx) || 1e-9), NO_A / 2 / (Math.abs(dy) || 1e-9))
    const k = (t * dist + 4) / dist // sai da borda do nó, com uma folga
    const p1 = { x: a.x + dx * k, y: a.y + dy * k }
    const p2 = { x: b.x - dx * k, y: b.y - dy * k }
    const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    const seta = [-0.45, 0.45].map((d) => `${p2.x + 11 * Math.cos(ang + Math.PI + d)},${p2.y + 11 * Math.sin(ang + Math.PI + d)}`)
    const id = `${de}>${para}`
    return (
      <g key={id} className={`aresta${id in luz ? ' aresta--acesa' : ''}`} style={estilo(id)}>
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />
        <polygon points={`${p2.x},${p2.y} ${seta.join(' ')}`} />
      </g>
    )
  }

  return (
    <div className="diagrama" ref={ref as RefObject<HTMLDivElement>}>
      <svg key={chave} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label="Caminho de um lance: front, escrita, Event Store, Kafka, leitura e SSE de volta ao front; o agendador consome do Kafka">
        {ARESTAS.map(([a, b]) => aresta(a, b))}
        {(Object.keys(POS) as No[]).map((n) => {
          const c = centro(n)
          return (
            <g key={n} className={`no${n in luz ? ' no--aceso' : ''}`} style={estilo(n)}>
              <rect x={c.x - NO_L / 2} y={c.y - NO_A / 2} width={NO_L} height={NO_A} rx="10" />
              <text x={c.x} y={c.y - 4} textAnchor="middle" className="no-nome">{ROTULOS[n][0]}</text>
              <text x={c.x} y={c.y + 15} textAnchor="middle" className="no-detalhe">{ROTULOS[n][1]}</text>
            </g>
          )
        })}
        {gravacaoMs !== null && (
          <text x={(centro('front').x + centro('eventstore').x) / 2} y={18} textAnchor="middle" className="tempo">
            gravação: {Math.round(gravacaoMs)} ms
          </text>
        )}
        {propagacaoMs !== null && (
          <text x={W / 2} y={H - 16} textAnchor="middle" className="tempo">
            propagação (outbox, Kafka, leitura e SSE): {Math.round(propagacaoMs)} ms
          </text>
        )}
      </svg>
    </div>
  )
}
