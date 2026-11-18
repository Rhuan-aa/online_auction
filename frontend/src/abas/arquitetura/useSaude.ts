import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { cartoesInfra, cartoesServicos, SERVICOS, type Cartao } from './saude.ts'

export const INTERVALO_SAUDE_MS = 5000

/** Consulta a saúde a cada 5 s, só com a página visível e só enquanto montado. */
export function useSaude(): Cartao[] | null {
  const [cartoes, setCartoes] = useState<Cartao[] | null>(null)
  useEffect(() => {
    let vivo = true
    async function consultar() {
      if (document.visibilityState !== 'visible') return
      const [servicos, infra] = await Promise.all([
        Promise.allSettled(SERVICOS.map((s) => api.saudeServico(s.id))),
        Promise.allSettled([api.saudeInfra()]),
      ])
      if (vivo) setCartoes([...cartoesServicos(servicos), ...cartoesInfra(infra[0])])
    }
    void consultar()
    const timer = setInterval(() => void consultar(), INTERVALO_SAUDE_MS)
    document.addEventListener('visibilitychange', consultar)
    return () => { vivo = false; clearInterval(timer); document.removeEventListener('visibilitychange', consultar) }
  }, [])
  return cartoes
}
