import { useEffect, useState } from 'react'
import { api, type EventoGravado } from '../../api.ts'
import Passos from '../../shell/Passos.tsx'
import PorQue from '../../shell/PorQue.tsx'
import CartaoCqrs from './CartaoCqrs.tsx'
import CartaoCrud from './CartaoCrud.tsx'
import CartaoFixo from './CartaoFixo.tsx'
import { chaveJanela, ROTEIRO_KAFKA, ROTEIRO_REST, ultimosLances } from './cenarios.ts'

const PORQUE = (
  <p>
    Cada cartão compara a nossa escolha com a alternativa mais comum. São ilustrações: os números reais estão nas outras abas.
  </p>
)

interface Props { pergunta: string; passo: number; leilaoId: string | null; versao: number | null }

interface Carga { id: string; eventos: EventoGravado[]; erro: boolean }

/** Eventos do leilão em foco; recarrega quando a versão muda. Sem leilão, lista vazia. */
function useEventos(leilaoId: string | null, versao: number | null): { eventos: EventoGravado[]; erro: boolean } {
  const [carga, setCarga] = useState<Carga | null>(null)
  useEffect(() => {
    if (!leilaoId) return
    let vigente = true
    api.eventos(leilaoId)
      .then((eventos) => { if (vigente) setCarga({ id: leilaoId, eventos, erro: false }) })
      .catch(() => { if (vigente) setCarga((c) => ({ id: leilaoId, eventos: c?.id === leilaoId ? c.eventos : [], erro: true })) })
    return () => { vigente = false }
  }, [leilaoId, versao])
  return leilaoId && carga?.id === leilaoId ? carga : { eventos: [], erro: false }
}

export default function AbaESeFosse({ pergunta, passo, leilaoId, versao }: Props) {
  const { eventos, erro } = useEventos(leilaoId, versao)
  // A chave reinicia o player quando muda o leilão ou a janela de lances mostrada.
  const chave = chaveJanela(leilaoId, ultimosLances(eventos))
  return (
    <Passos passo={passo}>
      <CartaoCrud key={`crud-${chave}`} eventos={eventos} erro={erro} />
      <CartaoCqrs key={`cqrs-${chave}`} eventos={eventos} erro={erro} />
      <CartaoFixo titulo="REST síncrono × broker" roteiro={ROTEIRO_REST} />
      <CartaoFixo titulo="RabbitMQ × Kafka" roteiro={ROTEIRO_KAFKA} />
      <PorQue titulo={pergunta}>{PORQUE}</PorQue>
    </Passos>
  )
}
