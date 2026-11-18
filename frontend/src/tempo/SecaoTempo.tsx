import { useEffect, useState } from 'react'
import { api, type EventoGravado } from '../api.ts'
import LinhaDoTempo from './LinhaDoTempo.tsx'
import ViagemNoTempo from './ViagemNoTempo.tsx'

interface Props { leilaoId: string; atual: number }

/** Linha do tempo dos eventos e o slider de versão, lado a lado. Remontada a cada leilão (key no App). */
export default function SecaoTempo({ leilaoId, atual }: Props) {
  const [eventos, setEventos] = useState<EventoGravado[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [escolhida, setEscolhida] = useState<number | null>(null) // null = acompanha a versão mais nova
  const versao = Math.min(escolhida ?? atual, atual)

  useEffect(() => {
    let vigente = true
    api.eventos(leilaoId)
      .then((l) => { if (vigente) { setEventos(l); setErro(null) } })
      .catch((e: unknown) => { if (vigente) setErro(e instanceof Error ? e.message : String(e)) })
    return () => { vigente = false }
  }, [leilaoId, atual]) // atual muda quando chega um evento novo

  return (
    <div className="tempo-secao">
      <div className="painel">
        <h3 className="tempo-subtitulo">Linha do tempo</h3>
        <p className="suave">{eventos.length} eventos gravados; clique em um para ver o JSON.</p>
        {erro && <p role="alert" className="erro">{erro}</p>}
        <LinhaDoTempo eventos={eventos} selecionada={versao} />
      </div>
      <div className="painel">
        <h3 className="tempo-subtitulo">Voltar no tempo</h3>
        <p className="suave">Arraste a versão: o servidor refaz o estado naquele ponto, aplicando só os eventos até ela.</p>
        {atual > 0
          ? <ViagemNoTempo leilaoId={leilaoId} atual={atual} versao={versao} aoMudar={(v) => setEscolhida(v >= atual ? null : v)} />
          : <p className="suave">Carregando o leilão…</p>}
      </div>
    </div>
  )
}
