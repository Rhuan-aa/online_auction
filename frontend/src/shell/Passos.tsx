import { Children, useContext, useEffect, type ReactNode } from 'react'
import { secaoDe } from '../secoes.ts'
import { SlideContexto } from './contexto.ts'

/**
 * Os passos (slides) de uma seção, na ordem do registro em secoes.ts: um filho por passo.
 * Todos ficam montados e só o ativo aparece (os outros com `hidden`), então o estado e os processos
 * longos de cada passo sobrevivem à troca de passo dentro da seção.
 *
 * Regras: um filho por passo do registro, sempre (sem passo condicional: mostre um estado vazio
 * dentro do slide); passos escondidos continuam montados, então não presuma que estão visíveis.
 */
export default function Passos({ passo, children }: { passo: number; children: ReactNode }) {
  const { aba } = useContext(SlideContexto)
  const filhos = Children.toArray(children)
  const registrados = secaoDe(aba).passos.length
  useEffect(() => {
    if (import.meta.env.DEV && filhos.length !== registrados) {
      console.error(`<Passos> da seção "${aba}" tem ${filhos.length} filhos, mas secoes.ts registra ${registrados} passos.`)
    }
  }, [aba, filhos.length, registrados])
  return filhos.map((filho, i) => (
    <SlideContexto key={i} value={{ aba, passo: i + 1 }}>
      <div className="slide-passo" hidden={i + 1 !== passo}>{filho}</div>
    </SlideContexto>
  ))
}
