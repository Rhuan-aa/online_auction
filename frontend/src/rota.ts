// Navegação pelo hash da URL, sem biblioteca: #/{aba}/{passo}?leilao={id}, com passo a partir de 1.
// O hash deixa abrir o mesmo leilão em duas abas do navegador e usar o botão "voltar".
// Continuam valendo #/{aba}?leilao= (passo 1) e a rota antiga #/leilao/{id}, para links antigos não quebrarem.
import { useEffect, useState } from 'react'
import { ehAba, passosVisiveis, SECOES, type Aba } from './secoes.ts'

export type { Aba } from './secoes.ts'

/** As 6 seções, na ordem da apresentação (com rótulo, pergunta e passos). */
export const ABAS = SECOES

export interface Rota {
  aba: Aba
  passo: number
  leilaoId: string | null
}

const PADRAO: Aba = 'integridade'

/** "2" → 2; vazio, não inteiro, < 1 ou além dos passos da seção → 1. */
function lerPasso(aba: Aba, texto: string | undefined): number {
  if (!texto || !/^\d+$/.test(texto)) return 1
  const n = Number(texto)
  return n >= 1 && n <= passosVisiveis(aba) ? n : 1
}

export function lerRota(hash: string): Rota {
  const [caminho, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [primeiro, segundo] = caminho.split('/')
  if (primeiro === 'leilao' && segundo) {
    try {
      return { aba: PADRAO, passo: 1, leilaoId: decodeURIComponent(segundo) }
    } catch {
      return { aba: PADRAO, passo: 1, leilaoId: null } // id com escape malformado não serve como id de leilão
    }
  }
  const leilao = new URLSearchParams(query).get('leilao')
  const aba = ehAba(primeiro) ? primeiro : PADRAO
  return { aba, passo: lerPasso(aba, segundo), leilaoId: leilao || null }
}

/** O passo só entra no hash quando passa de 1: #/rede e #/rede/1 são a mesma tela. */
export function hrefDe(r: { aba: Aba; passo?: number; leilaoId: string | null }): string {
  const base = r.passo && r.passo > 1 ? `#/${r.aba}/${r.passo}` : `#/${r.aba}`
  return r.leilaoId ? `${base}?leilao=${encodeURIComponent(r.leilaoId)}` : base
}

/** Próximo slide: o passo seguinte ou, no último passo, o primeiro da próxima seção. Para no fim. */
export function proximo(r: Rota): Rota {
  if (r.passo < passosVisiveis(r.aba)) return { ...r, passo: r.passo + 1 }
  const i = SECOES.findIndex((s) => s.id === r.aba)
  const seguinte = SECOES[i + 1]
  return seguinte ? { ...r, aba: seguinte.id, passo: 1 } : r
}

/** Slide anterior: o passo de antes ou, no primeiro passo, o último da seção anterior. Para no começo. */
export function anterior(r: Rota): Rota {
  if (r.passo > 1) return { ...r, passo: r.passo - 1 }
  const i = SECOES.findIndex((s) => s.id === r.aba)
  const previa = i > 0 ? SECOES[i - 1] : undefined
  return previa ? { ...r, aba: previa.id, passo: passosVisiveis(previa.id) } : r
}

export function useRota(): Rota {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const aoMudar = () => setHash(window.location.hash)
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return lerRota(hash)
}
