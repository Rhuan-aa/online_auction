import { useEffect, useState } from 'react'
import { api, type EstadoLeilao, type EventoGravado } from '../../api.ts'
import Passos from '../../shell/Passos.tsx'
import PorQue from '../../shell/PorQue.tsx'
import Slide from '../../shell/Slide.tsx'
import LinhaDoTempo from './LinhaDoTempo.tsx'
import Reconstrucao from './Reconstrucao.tsx'
import ViagemNoTempo from './ViagemNoTempo.tsx'

const PORQUE = (
  <p>
    Cada fato é gravado uma vez e nunca é alterado (trigger append-only no banco). O estado é calculado aplicando os
    eventos em ordem; por isso dá para refazê-lo em qualquer versão e apagar as cópias sem perder nada (ADR-002).
  </p>
)

interface Props { pergunta: string; passo: number; estado: EstadoLeilao | null }

/**
 * Pergunta 4, em 4 passos (secoes.ts). O estado (eventos, versão escolhida no slider, reconstrução)
 * fica aqui e é refeito a cada leilão; a seção continua montada ao trocar de passo.
 */
export default function AbaAuditoria({ pergunta, passo, estado }: Props) {
  return <Conteudo key={estado?.leilaoId ?? ''} pergunta={pergunta} passo={passo} leilaoId={estado?.leilaoId ?? null} atual={estado?.versao ?? 0} />
}

const SEM_LEILAO = <p className="slide-vazio">Escolha um leilão no palco</p>

function Conteudo({ pergunta, passo, leilaoId, atual }: { pergunta: string; passo: number; leilaoId: string | null; atual: number }) {
  const [eventos, setEventos] = useState<EventoGravado[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [escolhida, setEscolhida] = useState<number | null>(null) // null = acompanha a versão mais nova
  const versao = Math.min(escolhida ?? atual, atual)

  // Recarrega a lista quando chega um evento novo.
  useEffect(() => {
    if (!leilaoId) return
    let vigente = true
    api.eventos(leilaoId)
      .then((l) => { if (vigente) { setEventos(l); setErro(null) } })
      .catch((e: unknown) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)) })
    return () => { vigente = false }
  }, [leilaoId, atual]) // atual muda quando chega um evento novo

  return (
    <Passos passo={passo}>
      <Slide
        titulo={pergunta}
        texto={<p>Linha do tempo ({eventos.length} eventos). Clique em um evento para ver o JSON gravado.</p>}
      >
        {leilaoId ? (
          <>
            {erro && <p role="alert" className="erro">{erro}</p>}
            <LinhaDoTempo eventos={eventos} selecionada={versao} />
          </>
        ) : SEM_LEILAO}
      </Slide>
      {leilaoId
        ? <ViagemNoTempo leilaoId={leilaoId} atual={atual} versao={versao} aoMudar={(v) => setEscolhida(v >= atual ? null : v)} />
        : <Slide titulo="Voltar no tempo">{SEM_LEILAO}</Slide>}
      <Reconstrucao />
      <PorQue adr="ADR-002">{PORQUE}</PorQue>
    </Passos>
  )
}
