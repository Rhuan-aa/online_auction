import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { cartaoServico, cartoesInfra, SERVICOS, type Cartao } from './saude.ts'

export const INTERVALO_SAUDE_MS = 5000
const ORDEM = [...SERVICOS.map((s) => s.id), 'postgres', 'redis', 'kafka']

/** Consulta a saúde a cada 5 s, só com a página visível e só enquanto montado. Cada cartão atualiza quando a sua resposta chega. */
export function useSaude(): Cartao[] | null {
  const [porId, setPorId] = useState<Record<string, Cartao>>({})
  useEffect(() => {
    let vivo = true
    const emVoo = new Set<string>() // por cartão: um serviço travado não atrasa os outros
    const por = (cs: Cartao[]) => { if (vivo) setPorId((p) => ({ ...p, ...Object.fromEntries(cs.map((c) => [c.id, c])) })) }
    function pedir<T>(id: string, req: () => Promise<T>, mapa: (r: PromiseSettledResult<T>) => Cartao[]) {
      if (emVoo.has(id)) return
      emVoo.add(id)
      req().then((value) => mapa({ status: 'fulfilled', value }), (reason) => mapa({ status: 'rejected', reason }))
        .then(por).finally(() => emVoo.delete(id))
    }
    function consultar() {
      if (document.visibilityState !== 'visible') return
      SERVICOS.forEach((s, i) => pedir(s.id, () => api.saudeServico(s.id), (r) => [cartaoServico(i, r)]))
      pedir('infra', () => api.saudeInfra(), cartoesInfra)
    }
    consultar()
    const timer = setInterval(consultar, INTERVALO_SAUDE_MS)
    document.addEventListener('visibilitychange', consultar)
    return () => { vivo = false; clearInterval(timer); document.removeEventListener('visibilitychange', consultar) }
  }, [])
  return Object.keys(porId).length ? ORDEM.filter((id) => porId[id]).map((id) => porId[id]) : null
}
