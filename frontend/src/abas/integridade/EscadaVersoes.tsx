import type { ResultadoLance } from '../../api.ts'
import { dinheiro } from '../../formato.ts'
import { agruparAceitos, type ResultadoRajada } from './rajada.ts'

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

/** Um degrau por versão gravada (os aceitos, do mais alto para o mais baixo) e, embaixo, a versão em que todos mediram. */
export default function EscadaVersoes({ versao, resultados }: Props) {
  const degraus = agruparAceitos(resultados).reverse()
  const ficaram = resultados.filter((r) => r.resultado.tipo !== 'aceito')
  const resumo = degraus.length === 0 ? `nenhum lance subiu da versão ${versao}` : `${degraus.length} versões gravadas a partir da ${versao}`
  return (
    <div className="escada" role="group" aria-label={`Lances a partir da versão ${versao}: ${resumo}`}>
      {degraus.length === 0 && (
        <div className="degrau degrau-alto">
          <span className="degrau-versao">v{versao + 1}</span>
          <span className="suave">ninguém chegou aqui</span>
        </div>
      )}
      {degraus.map((d) => (
        <div className="degrau degrau-alto" key={d.versao}>
          <span className="degrau-versao">v{d.versao}</span>
          <ul>{d.resultados.map((r, i) => <Ficha key={i} r={r} />)}</ul>
        </div>
      ))}
      <div className="degrau">
        <span className="degrau-versao">v{versao}</span>
        <ul>{ficaram.map((r, i) => <Ficha key={i} r={r} />)}</ul>
      </div>
    </div>
  )
}
