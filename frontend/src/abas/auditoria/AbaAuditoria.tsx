import { useEffect, useState } from 'react'
import { api, type EstadoLeilao, type EventoGravado } from '../../api.ts'
import Aba from '../../shell/Aba.tsx'
import LinhaDoTempo from './LinhaDoTempo.tsx'
import Reconstrucao from './Reconstrucao.tsx'
import ViagemNoTempo from './ViagemNoTempo.tsx'

const PORQUE = (
  <p>
    Cada fato é gravado uma vez e nunca é alterado (trigger append-only no banco). O estado é calculado aplicando os
    eventos em ordem; por isso dá para refazê-lo em qualquer versão e apagar as cópias sem perder nada (ADR-002).
  </p>
)

interface Props { pergunta: string; estado: EstadoLeilao | null; ultimaVersao: number | null }

export default function AbaAuditoria({ pergunta, estado, ultimaVersao }: Props) {
  return (
    <Aba pergunta={pergunta} adr="ADR-002" porQue={PORQUE}>
      {estado
        ? <Conteudo key={estado.leilaoId} leilaoId={estado.leilaoId} atual={estado.versao} ultimaVersao={ultimaVersao} />
        : <p className="suave">Escolha um leilão no palco</p>}
    </Aba>
  )
}

function Conteudo({ leilaoId, atual, ultimaVersao }: { leilaoId: string; atual: number; ultimaVersao: number | null }) {
  const [eventos, setEventos] = useState<EventoGravado[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [escolhida, setEscolhida] = useState<number | null>(null) // null = acompanha a versão mais nova
  const versao = Math.min(escolhida ?? atual, atual)

  // Recarrega a lista quando chega um evento novo.
  useEffect(() => {
    let vigente = true
    api.eventos(leilaoId)
      .then((l) => { if (vigente) { setEventos(l); setErro(null) } })
      .catch((e: unknown) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)) })
    return () => { vigente = false }
  }, [leilaoId, ultimaVersao])

  return (
    <>
      <section className="bloco-aba">
        <h2>Voltar no tempo</h2>
        <ViagemNoTempo leilaoId={leilaoId} atual={atual} versao={versao} aoMudar={setEscolhida} />
      </section>
      <section className="bloco-aba">
        <h2>Linha do tempo ({eventos.length} eventos)</h2>
        {erro && <p role="alert" className="erro">{erro}</p>}
        <LinhaDoTempo eventos={eventos} selecionada={versao} />
      </section>
      <section className="bloco-aba">
        <h2>Apagar as cópias e refazer</h2>
        <Reconstrucao />
      </section>
    </>
  )
}
