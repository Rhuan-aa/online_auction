import { useSaude } from './useSaude.ts'

export default function Saude() {
  const cartoes = useSaude()
  return (
    <section className="bloco-aba">
      <h2>Saúde dos serviços e da infraestrutura</h2>
      {!cartoes && <p className="suave">Consultando…</p>}
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
    </section>
  )
}
