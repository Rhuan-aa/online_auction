// A página é uma só; o hash guarda apenas o leilão de demonstração das seções "caminho" e "tempo":
// #?leilao={id}. Qualquer caminho antes do "?" é ignorado (links antigos #/aba?leilao= continuam valendo).
import { useEffect, useState } from 'react'

export function lerLeilao(hash: string): string | null {
  const i = hash.indexOf('?')
  if (i < 0) return null
  return new URLSearchParams(hash.slice(i + 1)).get('leilao') || null
}

export function hrefDe(leilaoId: string | null): string {
  return leilaoId ? `#?leilao=${encodeURIComponent(leilaoId)}` : '#'
}

/** Troca o leilão sem rolar a página nem criar entrada nova no histórico. */
export function escolherLeilao(leilaoId: string | null): void {
  history.replaceState(null, '', hrefDe(leilaoId))
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function useLeilaoDaRota(): string | null {
  const [hash, setHash] = useState(window.location.hash)
  useEffect(() => {
    const aoMudar = () => setHash(window.location.hash)
    window.addEventListener('hashchange', aoMudar)
    return () => window.removeEventListener('hashchange', aoMudar)
  }, [])
  return lerLeilao(hash)
}
