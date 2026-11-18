import { anterior, hrefDe, irPara, proximo, type Rota } from '../rota.ts'
import { passosVisiveis, secaoDe } from '../secoes.ts'

/** ← → (cruzam seções) e as bolinhas dos passos da seção atual. */
export default function Navegacao({ rota }: { rota: Rota }) {
  const antes = anterior(rota)
  const depois = proximo(rota)
  const secao = secaoDe(rota.aba)
  const total = passosVisiveis(rota.aba)
  return (
    <nav className="navegacao" aria-label="Slides">
      <button type="button" className="nav-seta" onClick={() => irPara(antes)} disabled={antes === rota}
        aria-label="Slide anterior" title="Slide anterior (←)">←</button>
      <button type="button" className="nav-seta" onClick={() => irPara(depois)} disabled={depois === rota}
        aria-label="Próximo slide" title="Próximo slide (→)">→</button>
      {total > 1 && (
        <ol className="nav-passos">
          {secao.passos.slice(0, total).map((p, i) => (
            <li key={p.id}>
              <a href={hrefDe({ ...rota, passo: i + 1 })} aria-current={i + 1 === rota.passo ? 'step' : undefined}
                aria-label={`Passo ${i + 1}: ${p.titulo}`} title={p.titulo} />
            </li>
          ))}
        </ol>
      )}
    </nav>
  )
}
