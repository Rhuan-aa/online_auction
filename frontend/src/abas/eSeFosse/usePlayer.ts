import { useEffect, useState } from 'react'
import { avancar, limitar } from './cenarios.ts'

const INTERVALO_MS = 1200

/** Player de um cenário: passo atual (0 = antes de começar), ▶ ⏸ ⏭ ↺ e o fim. O passo é limitado ao total. */
export function usePlayer(total: number, desabilitado: boolean) {
  const [passoBruto, setPasso] = useState(0)
  const [tocando, setTocando] = useState(false)
  const passo = limitar(passoBruto, total)
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

  return {
    passo, fim, tocando, desabilitado,
    tocar() {
      if (fim) setPasso(0)
      setTocando(true)
    },
    pausar() { setTocando(false) },
    proximo() { setTocando(false); setPasso((p) => avancar(p, total)) },
    reiniciar() { setTocando(false); setPasso(0) },
  }
}

export type Player = ReturnType<typeof usePlayer>
