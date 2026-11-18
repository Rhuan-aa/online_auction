import { useState, type KeyboardEvent } from 'react'

/**
 * Tooltips dispensáveis com Escape (WCAG 1.4.13): Escape esconde a dica sem tirar o foco nem o ponteiro;
 * ela volta ao focar ou entrar em outro elemento. O CSS lê `data-dica-oculta`.
 */
export function useDicaDispensavel() {
  const [oculta, setOculta] = useState(false)
  return {
    atributo: oculta ? { 'data-dica-oculta': '' } : {},
    aoTeclar: (e: KeyboardEvent) => { if (e.key === 'Escape') setOculta(true) },
    reexibir: () => setOculta(false),
  }
}
