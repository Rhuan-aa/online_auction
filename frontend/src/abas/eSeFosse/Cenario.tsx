import { useEffect, useState, type ReactNode } from 'react'
import { avancar } from './cenarios.ts'

const INTERVALO_MS = 1200

interface Props {
  titulo: string
  /** Legenda de cada passo (índice 0 = passo 1). */
  legendas: string[]
  conclusao: string
  /** Conteúdo de cada lado no passo atual (0 = antes de começar). */
  nosso: (passo: number) => ReactNode
  alternativa: (passo: number) => ReactNode
  /** Quando preenchido, o cartão mostra o aviso no lugar dos lados e trava os controles. */
  indisponivel?: string
}

/** Cartão com o selo "ilustração", os dois lados e os controles ▶ ⏸ ⏭ ↺. */
export default function Cenario({ titulo, legendas, conclusao, nosso, alternativa, indisponivel }: Props) {
  const total = legendas.length
  const [passo, setPasso] = useState(0)
  const [tocando, setTocando] = useState(false)
  const desabilitado = indisponivel != null || total === 0
  const fim = passo >= total

  // Um passo a cada intervalo; o timer é limpo ao pausar, ao chegar no fim e ao desmontar.
  useEffect(() => {
    if (!tocando || fim) return
    const t = setTimeout(() => {
      setPasso((p) => avancar(p, total))
      if (passo + 1 >= total) setTocando(false)
    }, INTERVALO_MS)
    return () => clearTimeout(t)
  }, [tocando, passo, fim, total])

  function tocar() {
    if (fim) setPasso(0)
    setTocando(true)
  }

  return (
    <article className="cenario">
      <header className="cenario-topo">
        <span className="selo-ilustracao">ilustração</span>
        <h2>{titulo}</h2>
      </header>
      {indisponivel != null ? <p className="suave cenario-vazio">{indisponivel}</p> : (
        <>
          <div className="cenario-lados">
            <section className="cenario-lado cenario-lado--nosso" aria-label="Nosso sistema">
              <h3>Nosso sistema</h3>
              {nosso(passo)}
            </section>
            <section className="cenario-lado" aria-label="Alternativa">
              <h3>Alternativa</h3>
              {alternativa(passo)}
            </section>
          </div>
          <p className="cenario-legenda" aria-live="polite">
            {passo === 0 ? 'Aperte ▶ para começar.' : `${passo}/${total}. ${legendas[passo - 1]}`}
          </p>
          {fim && !desabilitado && <p className="cenario-conclusao">{conclusao}</p>}
        </>
      )}
      <div className="cenario-controles">
        <button type="button" className="botao botao--destaque" disabled={desabilitado || tocando} onClick={tocar} aria-label="Tocar">▶</button>
        <button type="button" className="botao" disabled={desabilitado || !tocando} onClick={() => setTocando(false)} aria-label="Pausar">⏸</button>
        <button type="button" className="botao" disabled={desabilitado || fim} onClick={() => { setTocando(false); setPasso((p) => avancar(p, total)) }} aria-label="Próximo passo">⏭</button>
        <button type="button" className="botao" disabled={desabilitado || passo === 0} onClick={() => { setTocando(false); setPasso(0) }} aria-label="Reiniciar">↺</button>
      </div>
    </article>
  )
}
