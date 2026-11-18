import type { ReactNode } from 'react'
import { hrefDe } from '../../rota.ts'
import Slide from '../../shell/Slide.tsx'
import { ADRS } from './adrs.ts'

/** Passo 3: as quatro decisões; cada cartão leva ao passo 1 da aba que a mostra em ação. */
export default function Decisoes({ leilaoId, porQue }: { leilaoId: string | null; porQue: ReactNode }) {
  return (
    <Slide layout="largo" titulo="Decisões de arquitetura" texto={porQue}>
      <div className="adr-grade">
        {ADRS.map((a) => (
          <a key={a.id} className="adr-cartao" href={hrefDe({ aba: a.aba, passo: 1, leilaoId })}>
            <span className="id">{a.id}</span>
            <strong>{a.titulo}</strong>
            <span>{a.decisao}</span>
          </a>
        ))}
      </div>
    </Slide>
  )
}
