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

/** Próximo slide: o passo seguinte ou, no último passo, o primeiro da próxima seção. No fim, devolve a mesma rota (veja temProximo). */
export function proximo(r: Rota): Rota {
  if (r.passo < passosVisiveis(r.aba)) return { ...r, passo: r.passo + 1 }
  const i = SECOES.findIndex((s) => s.id === r.aba)
  const seguinte = SECOES[i + 1]
  return seguinte ? { ...r, aba: seguinte.id, passo: 1 } : r
}

/** Há slide depois deste? (false só no último passo da última seção) */
export function temProximo(r: Rota): boolean {
  return r.passo < passosVisiveis(r.aba) || SECOES.findIndex((s) => s.id === r.aba) < SECOES.length - 1
}

/** Há slide antes deste? (false só no primeiro passo da primeira seção) */
export function temAnterior(r: Rota): boolean {
  return r.passo > 1 || SECOES.findIndex((s) => s.id === r.aba) > 0
}

/** Slide anterior: o passo de antes ou, no primeiro passo, o último da seção anterior. No começo, devolve a mesma rota (veja temAnterior). */
export function anterior(r: Rota): Rota {
  if (r.passo > 1) return { ...r, passo: r.passo - 1 }
  const i = SECOES.findIndex((s) => s.id === r.aba)
  const previa = i > 0 ? SECOES[i - 1] : undefined
  return previa ? { ...r, aba: previa.id, passo: passosVisiveis(previa.id) } : r
}

/** Vai para outra tela trocando o hash (entra no histórico: o "voltar" do navegador volta um slide). */
export function irPara(r: Rota): void {
  window.location.hash = hrefDe(r)
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
