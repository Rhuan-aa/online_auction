// Navegação pelo hash da URL, sem biblioteca: #/{aba}?leilao={id}.
// O hash deixa abrir o mesmo leilão em duas abas do navegador e usar o botão "voltar".
// A rota antiga #/leilao/{id} continua valendo, para links antigos não quebrarem.
import { useEffect, useState } from 'react'

export type Aba = 'integridade' | 'desempenho' | 'rede' | 'auditoria' | 'arquitetura' | 'e-se-fosse'

export const ABAS: { id: Aba; rotulo: string; pergunta: string }[] = [
  { id: 'integridade', rotulo: 'Integridade', pergunta: 'Dois lances ao mesmo tempo: quem ganha?' },
  { id: 'desempenho', rotulo: 'Desempenho', pergunta: 'O cache ajuda mesmo?' },
  { id: 'rede', rotulo: 'Rede', pergunta: 'Quanto custa ficar ao vivo?' },
  { id: 'auditoria', rotulo: 'Auditoria', pergunta: 'Dá para voltar no tempo?' },
  { id: 'arquitetura', rotulo: 'Arquitetura', pergunta: 'Por onde passa um lance?' },
  { id: 'e-se-fosse', rotulo: 'E se fosse…?', pergunta: 'Por que não do jeito comum?' },
]

export interface Rota {
  aba: Aba
  leilaoId: string | null
}

const PADRAO: Aba = 'integridade'

function ehAba(s: string): s is Aba {
  return ABAS.some((a) => a.id === s)
}

export function lerRota(hash: string): Rota {
  const [caminho, query = ''] = hash.replace(/^#\/?/, '').split('?')
  const [primeiro, id] = caminho.split('/')
  if (primeiro === 'leilao' && id) {
    try {
      return { aba: PADRAO, leilaoId: decodeURIComponent(id) }
    } catch {
      return { aba: PADRAO, leilaoId: null } // id com escape malformado não serve como id de leilão
    }
  }
  const leilao = new URLSearchParams(query).get('leilao')
  return { aba: ehAba(primeiro) ? primeiro : PADRAO, leilaoId: leilao || null }
}

export function hrefDe(r: Rota): string {
  const base = `#/${r.aba}`
  return r.leilaoId ? `${base}?leilao=${encodeURIComponent(r.leilaoId)}` : base
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
