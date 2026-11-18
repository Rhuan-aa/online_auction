import { useCallback, useEffect, useState } from 'react'
import { assinar, registros, type Registro } from '../../rede.ts'
import { criarThrottle } from './throttle.ts'

/** Registros da rede ao vivo (no máximo ~4 renderizações por segundo) e um `recarregar` imediato (após limpar). */
export function useRegistros(): [Registro[], () => void] {
  const [lista, setLista] = useState<Registro[]>(registros)
  useEffect(() => {
    const t = criarThrottle(() => setLista(registros()), 250)
    const desassinar = assinar(t.acionar)
    return () => { desassinar(); t.cancelar() }
  }, [])
  const recarregar = useCallback(() => setLista(registros()), [])
  return [lista, recarregar]
}
