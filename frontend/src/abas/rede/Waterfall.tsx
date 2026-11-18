import type { Registro } from '../../rede.ts'
import { layoutWaterfall } from './waterfall.ts'

const LINHA = 16

/** Últimas 30 requisições numa linha do tempo compartilhada; SSE aparece como ponto. */
export default function Waterfall({ registros }: { registros: Registro[] }) {
  const { duracao, linhas } = layoutWaterfall(registros)
  if (linhas.length === 0) return <p className="suave">Nenhuma requisição medida ainda.</p>
  const H = linhas.length * LINHA
  const resumo = `Waterfall das últimas ${linhas.length} requisições, em ${Math.round(duracao)} ms de linha do tempo`
  return (
    <div className="waterfall">
      <ul className="waterfall-rotulos" aria-hidden="true">
        {linhas.map((l) => <li key={l.registro.id} style={{ height: LINHA }}>{l.rotulo}</li>)}
      </ul>
      <svg viewBox={`0 0 1000 ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={resumo}>
        <title>{resumo}</title>
        {linhas.map((l, i) => {
          const x = l.inicio * 1000
          const detalhe = `${l.rotulo} · ${l.registro.status} · ${Math.round(l.registro.ms)} ms · ${l.registro.bytes} B`
          return l.ponto
            ? <rect key={l.registro.id} x={Math.max(0, x - 3)} y={i * LINHA + 3} width={6} height={LINHA - 6} rx={2} style={{ fill: l.cor }}><title>{detalhe}</title></rect>
            : <rect key={l.registro.id} x={x} y={i * LINHA + 3} width={Math.max(3, l.largura * 1000)} height={LINHA - 6} rx={2} style={{ fill: l.cor }}><title>{detalhe}</title></rect>
        })}
      </svg>
    </div>
  )
}
