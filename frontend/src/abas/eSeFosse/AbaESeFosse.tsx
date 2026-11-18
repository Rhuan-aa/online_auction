import { useEffect, useState } from 'react'
import { api, type EventoGravado } from '../../api.ts'
import Aba from '../../shell/Aba.tsx'
import CartaoCqrs from './CartaoCqrs.tsx'
import CartaoCrud from './CartaoCrud.tsx'
import CartaoFixo from './CartaoFixo.tsx'
import { ROTEIRO_KAFKA, ROTEIRO_REST } from './cenarios.ts'

const PORQUE = (
  <p>
    Cada cartão compara a nossa escolha com a alternativa mais comum. São ilustrações: os números reais estão nas outras abas.
  </p>
)

interface Props { pergunta: string; leilaoId: string | null; versao: number | null }

/** Eventos do leilão em foco; recarrega quando a versão muda. Sem leilão, lista vazia. */
function useEventos(leilaoId: string | null, versao: number | null): EventoGravado[] {
  const [dados, setDados] = useState<{ id: string; eventos: EventoGravado[] } | null>(null)
  useEffect(() => {
    if (!leilaoId) return
    let vigente = true
    api.eventos(leilaoId)
      .then((eventos) => { if (vigente) setDados({ id: leilaoId, eventos }) })
      .catch(() => { if (vigente) setDados(null) })
    return () => { vigente = false }
  }, [leilaoId, versao])
  return leilaoId && dados?.id === leilaoId ? dados.eventos : []
}

export default function AbaESeFosse({ pergunta, leilaoId, versao }: Props) {
  const eventos = useEventos(leilaoId, versao)
  return (
    <Aba pergunta={pergunta} porQue={PORQUE}>
      <div className="cenarios">
        <CartaoCrud eventos={eventos} />
        <CartaoCqrs eventos={eventos} />
        <CartaoFixo titulo="REST síncrono × broker" roteiro={ROTEIRO_REST} />
        <CartaoFixo titulo="RabbitMQ × Kafka" roteiro={ROTEIRO_KAFKA} />
      </div>
    </Aba>
  )
}
