import { useCallback, useEffect, useState } from 'react'
import { assinar, registros, type Registro } from '../../rede.ts'

/** Registros da rede ao vivo (no máximo ~4 renderizações por segundo) e um `recarregar` imediato (após limpar). */
export function useRegistros(): [Registro[], () => void] {
  const [lista, setLista] = useState<Registro[]>(registros)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const desassinar = assinar(() => {
      if (timer !== undefined) return
      timer = setTimeout(() => { timer = undefined; setLista(registros()) }, 250)
    })
    return () => { desassinar(); clearTimeout(timer) }
  }, [])
  const recarregar = useCallback(() => setLista(registros()), [])
  return [lista, recarregar]
}
