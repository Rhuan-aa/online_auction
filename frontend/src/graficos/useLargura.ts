import { useEffect, useRef, useState } from 'react'

export const LARGURA_PADRAO = 640

/** Largura utilizável: valores inválidos ou 0 caem no padrão. */
export function larguraEfetiva(w: number | undefined): number {
  return w !== undefined && Number.isFinite(w) && w > 0 ? Math.round(w) : LARGURA_PADRAO
}

/** Mede a largura do elemento (1 unidade do viewBox = 1px CSS). Sem ResizeObserver, usa o padrão. */
export function useLargura() {
  const ref = useRef<HTMLElement | null>(null)
  const [largura, setLargura] = useState(LARGURA_PADRAO)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    setLargura(larguraEfetiva(el.getBoundingClientRect().width))
    const ro = new ResizeObserver((es) => setLargura(larguraEfetiva(es[0]?.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, largura] as const
}
