import { useEffect } from 'react'
import { anterior, irPara, proximo, type Rota } from '../rota.ts'
import type { Aba } from '../secoes.ts'

/** Campos e janelas onde as setas e PageUp/PageDown têm outro uso: lá o atalho não vale. */
const ONDE_NAO = 'input, select, textarea, [contenteditable]:not([contenteditable="false"]), dialog, [role="dialog"]'

function ehCampo(alvo: EventTarget | null): boolean {
  return alvo instanceof Element && (alvo.closest(ONDE_NAO) !== null || (alvo instanceof HTMLElement && alvo.isContentEditable))
}

/** ←/→ e PageUp/PageDown trocam de slide (cruzando seções), fora de campos e só enquanto `ativo`. */
export function useTeclasSlides(aba: Aba, passo: number, leilaoId: string | null, ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return
    const rota: Rota = { aba, passo, leilaoId }
    const aoTecla = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || ehCampo(e.target)) return
      const vai = e.key === 'ArrowRight' || e.key === 'PageDown'
      const volta = e.key === 'ArrowLeft' || e.key === 'PageUp'
      if (!vai && !volta) return
      e.preventDefault()
      const destino = vai ? proximo(rota) : anterior(rota)
      if (destino !== rota) irPara(destino)
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [aba, passo, leilaoId, ativo])
}
