// Navegação pelo hash da URL, sem biblioteca: #/ (lista), #/criar, #/leilao/{id}.
// O hash deixa abrir o mesmo leilão em duas abas e usar o botão "voltar".
import { useEffect, useState } from 'react'

export type Rota =
  | { tela: 'lista' }
  | { tela: 'criar' }
  | { tela: 'detalhe'; leilaoId: string }

export function lerRota(hash: string): Rota {
  const [, tela, id] = hash.replace(/^#/, '').split('/')
  if (tela === 'criar') return { tela: 'criar' }
  if (tela === 'leilao' && id) return { tela: 'detalhe', leilaoId: id }
  return { tela: 'lista' }
}

export const irPara = {
  lista: () => '#/',
  criar: () => '#/criar',
  detalhe: (leilaoId: string) => `#/leilao/${leilaoId}`,
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
