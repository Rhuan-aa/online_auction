import { useLayoutEffect, useRef, useState } from 'react'

const LARGURA_PADRAO = 640

/**
 * Próxima largura a partir de uma medida. Medida inválida ou 0 (elemento escondido, por exemplo um
 * passo de slide com `hidden`) não vale: fica a largura atual, sem re-renderizar o gráfico à toa.
 */
export function proximaLargura(atual: number, medida: number | undefined): number {
  return medida !== undefined && Number.isFinite(medida) && medida > 0 ? Math.round(medida) : atual
}

/**
 * Mede a largura do elemento (1 unidade do viewBox = 1px CSS). Sem ResizeObserver, usa o padrão.
 * O ResizeObserver dispara quando o elemento some (0) e quando reaparece (N): o 0 é ignorado e a
 * medida real entra ao ficar visível, então funciona em passos escondidos que continuam montados.
 */
export function useLargura() {
  const ref = useRef<HTMLElement | null>(null)
  const [largura, setLargura] = useState(LARGURA_PADRAO)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    setLargura((l) => proximaLargura(l, el.getBoundingClientRect().width))
    const ro = new ResizeObserver((es) => setLargura((l) => proximaLargura(l, es[0]?.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, largura] as const
}
