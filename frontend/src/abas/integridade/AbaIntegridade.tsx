import { useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import { podeDarLance } from '../../palco/palco.ts'
import Passos from '../../shell/Passos.tsx'
import PorQue from '../../shell/PorQue.tsx'
import Slide from '../../shell/Slide.tsx'
import EscadaVersoes from './EscadaVersoes.tsx'
import { MAX_RAJADA, MIN_RAJADA, planejarRajada, resumirRajada, type ResultadoRajada } from './rajada.ts'
import SimulacaoCompleta from './SimulacaoCompleta.tsx'

interface Props { pergunta: string; passo: number; agora: number; estado: EstadoLeilao | null; incrementoMinimo: number | null }

const PORQUE = (
  <p>
    O banco tem <code>UNIQUE(leilao_id, versao)</code> e cada lance chega com a <code>versaoEsperada</code>: quando
    dois lances leem a mesma versão, só um grava e o outro bate na restrição. O servidor refaz o perdedor, até 3
    tentativas, com o estado novo. Por isso sempre sobra um vencedor por versão e as versões ficam 1..n, sem buraco.
  </p>
)

/**
 * Pergunta 1, em 3 passos (secoes.ts): rajada no leilão em foco, simulação completa e "por que".
 * O estado da rajada fica aqui, na seção, que continua montada enquanto se troca de passo.
 */
export default function AbaIntegridade({ pergunta, passo, agora, estado, incrementoMinimo }: Props) {
  const [n, setN] = useState(4)
  const [mesmoValor, setMesmoValor] = useState(true)
  const [disparando, setDisparando] = useState(false)
  const [rajada, setRajada] = useState<{ versao: number; resultados: ResultadoRajada[] } | null>(null)
  // outro leilão em foco: a rajada anterior não vale para ele (só este estado é zerado)
  const [leilaoDaRajada, setLeilaoDaRajada] = useState(estado?.leilaoId ?? null)
  if (leilaoDaRajada !== (estado?.leilaoId ?? null)) {
    setLeilaoDaRajada(estado?.leilaoId ?? null)
    setRajada(null)
  }
  const liberado = podeDarLance(estado, agora)
  const pode = liberado.pode && estado !== null && incrementoMinimo !== null

  async function disparar() {
    if (!estado || incrementoMinimo === null) return
    const pedidos = planejarRajada(estado, incrementoMinimo, n, mesmoValor)
    setDisparando(true)
    try {
      const resultados = await Promise.all(pedidos.map(async (pedido): Promise<ResultadoRajada> => {
        const t0 = performance.now()
        const resultado = await api.darLance(estado.leilaoId, pedido)
        return { pedido, resultado, ms: performance.now() - t0 }
      }))
      setRajada({ versao: estado.versao, resultados })
    } finally {
      setDisparando(false)
    }
  }

  const resumo = rajada ? resumirRajada(rajada.resultados) : null

  const controles = (
    <>
      <div className="rajada-controles">
        <label>Lances ao mesmo tempo ({MIN_RAJADA}–{MAX_RAJADA})
          <input type="number" min={MIN_RAJADA} max={MAX_RAJADA} value={n} disabled={!pode || disparando}
            onChange={(e) => setN(Math.min(MAX_RAJADA, Math.max(MIN_RAJADA, Math.trunc(Number(e.target.value)) || MIN_RAJADA)))} />
        </label>
        <label className="opcao">
          <input type="checkbox" checked={mesmoValor} disabled={!pode || disparando} onChange={(e) => setMesmoValor(e.target.checked)} />
          Mesmo valor para todos
        </label>
      </div>
      <button type="button" className="botao botao--destaque" disabled={!pode || disparando} onClick={disparar}>
        {disparando ? 'Disparando…' : `▶ Disparar ${n} lances`}
      </button>
      {!pode && <p className="suave" role="status">{liberado.motivo ?? 'Aguardando o leilão carregar'}. Escolha ou crie um leilão aberto no palco.</p>}
    </>
  )

  return (
    <Passos passo={passo}>
      <Slide
        titulo={pergunta}
        texto={<p>Rajada no leilão em foco: vários lances saem juntos, lendo a mesma versão. A escada mostra quem gravou cada versão e quem ficou para trás.</p>}
        acao={controles}
      >
        {rajada && resumo
          ? (
            <>
              <div className="kpis">
                <div className="kpi"><strong>{resumo.aceitos}</strong><span>aceitos</span></div>
                <div className="kpi"><strong>{resumo.recusados}</strong><span>recusados</span></div>
                <div className="kpi"><strong>{resumo.conflitos}</strong><span>conflitos</span></div>
                <div className="kpi"><strong>{resumo.colisoes}</strong><span>colisões (tentativas extras)</span></div>
              </div>
              <EscadaVersoes versao={rajada.versao} resultados={rajada.resultados} />
            </>
          )
          : <p className="slide-vazio">A escada de versões aparece aqui depois de disparar a rajada.</p>}
      </Slide>
      <SimulacaoCompleta />
      <PorQue adr="ADR-002">{PORQUE}</PorQue>
    </Passos>
  )
}
