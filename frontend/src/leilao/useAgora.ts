import { useEffect, useState } from 'react'

/** Relógio da tela: a hora atual, atualizada a cada segundo enquanto `ativo`. */
export function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ativo])
  return agora
}
