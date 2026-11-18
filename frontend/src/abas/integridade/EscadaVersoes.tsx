import type { ResultadoLance } from '../../api.ts'
import { dinheiro } from '../../formato.ts'
import type { ResultadoRajada } from './rajada.ts'

interface Props { versao: number; resultados: ResultadoRajada[] }

const ROTULO: Record<ResultadoLance['tipo'], string> = {
  aceito: 'aceito', recusado: 'recusado', conflito: 'conflito (409)', erro: 'erro',
}

function Ficha({ r }: { r: ResultadoRajada }) {
  const { resultado } = r
  const extras = resultado.tipo !== 'erro' && resultado.tentativas > 1 ? resultado.tentativas - 1 : 0
  const codigo = resultado.tipo === 'recusado' && resultado.codigo ? ` · ${resultado.codigo}` : ''
  return (
    <li className={`ficha ficha-${resultado.tipo}`}>
      <strong>{r.pedido.licitanteId}</strong>
      <span>{dinheiro(r.pedido.valor)} · {Math.round(r.ms)} ms</span>
      {extras > 0 && <span className="ficha-retentativa">tentou de novo ×{extras}</span>}
      <span className="ficha-resultado">{ROTULO[resultado.tipo]}{codigo}</span>
    </li>
  )
}

/** Dois degraus: a versão em que todos mediram e a seguinte. Só um lance sobe; os outros ficam embaixo. */
export default function EscadaVersoes({ versao, resultados }: Props) {
  const venceu = resultados.filter((r) => r.resultado.tipo === 'aceito')
  const ficaram = resultados.filter((r) => r.resultado.tipo !== 'aceito')
  return (
    <div className="escada" role="group" aria-label={`Lances disputando a versão ${versao + 1}`}>
      <div className="degrau degrau-alto">
        <span className="degrau-versao">v{versao + 1}</span>
        <ul>{venceu.map((r, i) => <Ficha key={i} r={r} />)}</ul>
        {venceu.length === 0 && <span className="suave">ninguém chegou aqui</span>}
      </div>
      <div className="degrau">
        <span className="degrau-versao">v{versao}</span>
        <ul>{ficaram.map((r, i) => <Ficha key={i} r={r} />)}</ul>
      </div>
    </div>
  )
}
