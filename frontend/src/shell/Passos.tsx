import { Children, useContext, type ReactNode } from 'react'
import { SlideContexto } from './contexto.ts'

/**
 * Os passos (slides) de uma seção, na ordem do registro em secoes.ts: um filho por passo.
 * Todos ficam montados e só o ativo aparece (os outros com `hidden`), então o estado e os processos
 * longos de cada passo sobrevivem à troca de passo dentro da seção.
 */
export default function Passos({ passo, children }: { passo: number; children: ReactNode }) {
  const { aba } = useContext(SlideContexto)
  return Children.toArray(children).map((filho, i) => (
    <SlideContexto key={i} value={{ aba, passo: i + 1 }}>
      <div className="slide-passo" hidden={i + 1 !== passo}>{filho}</div>
    </SlideContexto>
  ))
}
