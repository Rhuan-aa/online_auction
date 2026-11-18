import Slide from '../../shell/Slide.tsx'
import { useSaude } from './useSaude.ts'

/** Passo 2: os cartões de saúde numa grade que cabe na tela. */
export default function Saude() {
  const cartoes = useSaude()
  return (
    <Slide layout="largo" titulo="Saúde dos serviços e da infraestrutura">
      {!cartoes && <p className="slide-vazio">Consultando…</p>}
      {cartoes && (
        <div className="saude-grade">
          {cartoes.map((c) => (
            <div key={c.id} className={`saude-cartao saude-cartao--${c.status === 'UP' ? 'up' : 'down'}`}>
              <h3>{c.rotulo}</h3>
              <p className="saude-status">{c.status}</p>
              <p className="suave">{c.ms === null ? (c.nota ?? 'sem resposta') : `${c.ms} ms`}{c.ms !== null && c.nota ? ` · ${c.nota}` : ''}</p>
            </div>
          ))}
        </div>
      )}
    </Slide>
  )
}
