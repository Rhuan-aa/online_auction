import { useEffect, useState, useSyncExternalStore } from 'react'
import { api } from '../api.ts'
import { ControladorCorrida, type Estado } from './controlador.ts'
import type { Parametros } from './tipos.ts'

export type { Fase } from './controlador.ts'

export interface Corrida extends Estado {
  iniciar: (p: Parametros) => void
  parar: () => void
  /** Depois de um 409: acompanhar a corrida que já roda / pará-la. */
  acompanhar: () => void
  pararEmAndamento: () => void
}

/** Liga o ControladorCorrida ao React. O EventSource é fechado no `fim`, ao desmontar e ao iniciar outra. */
export function useCorrida(): Corrida {
  const [c] = useState(() => new ControladorCorrida(api))
  const estado = useSyncExternalStore(c.assinar, c.estadoAtual)
  useEffect(() => {
    c.montar()
    return () => c.descartar()
  }, [c])
  return {
    ...estado,
    iniciar: (p) => void c.iniciar(p),
    parar: () => void c.parar(),
    acompanhar: () => c.acompanhar(),
    pararEmAndamento: () => void c.pararEmAndamento(),
  }
}
