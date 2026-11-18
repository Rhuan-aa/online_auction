import type { EventoGravado } from '../../api.ts'
import { dinheiro } from '../../formato.ts'
import Cenario from './Cenario.tsx'
import { cqrsAtrasado, MIN_LANCES, SEM_LANCES, ultimosLances } from './cenarios.ts'

const ATRASO = 2

export default function CartaoCqrs({ eventos }: { eventos: EventoGravado[] }) {
  const lances = ultimosLances(eventos)
  const passos = cqrsAtrasado(lances, ATRASO)
  const pouco = lances.length < MIN_LANCES
  return (
    <Cenario
      titulo="CQRS × cache versionado"
      indisponivel={pouco ? SEM_LANCES : undefined}
      legendas={passos.map((p) => (p.precoVelho
        ? `A escrita já está em ${dinheiro(p.escrita)}, mas a réplica ainda mostra ${dinheiro(p.replica)}: alguém dá lance sobre ${dinheiro(p.replica)}, que já passou.`
        : `Escrita e réplica mostram ${dinheiro(p.escrita)}.`))}
      conclusao="Num leilão o preço mostrado não pode estar atrasado. O cache lê o mesmo estado da escrita e carrega a versão (PLANO §1)."
      nosso={(n) => {
        if (n === 0) return null
        const p = passos[n - 1]
        return (
          <>
            <p className="cenario-nota">escrita e leitura usam o mesmo estado versionado</p>
            <p className="cenario-valor">{dinheiro(p.escrita)}</p>
          </>
        )
      }}
      alternativa={(n) => {
        if (n === 0) return null
        const p = passos[n - 1]
        return (
          <>
            <p className="cenario-nota">escrita</p>
            <p className="cenario-valor">{dinheiro(p.escrita)}</p>
            <p className="cenario-nota">réplica de leitura (chega depois, via Kafka)</p>
            <p className={p.precoVelho ? 'cenario-valor cenario-valor--velho' : 'cenario-valor'}>{dinheiro(p.replica)}</p>
            {p.precoVelho && <p className="cenario-linha cenario-linha--aviso">alguém dá lance sobre {dinheiro(p.replica)}, que já passou</p>}
          </>
        )
      }}
    />
  )
}
