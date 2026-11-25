import { useCallback, useEffect, useState } from 'react'
import { acaoDaTecla, aplicar, limitar } from './navegacao.ts'

/** Liga/desliga o modo apresentação e controla a tela atual, com atalhos de teclado enquanto ligado. */
export function useApresentacao(total: number) {
  const [ativa, setAtiva] = useState(false)
  const [atual, setAtual] = useState(0)

  const ir = useCallback((i: number) => {
    setAtual(limitar(i, total))
    window.scrollTo({ top: 0 })
  }, [total])

  const entrar = useCallback(() => { setAtiva(true); ir(0) }, [ir])
  const sair = useCallback(() => setAtiva(false), [])

  useEffect(() => {
    if (!ativa) return
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const acao = acaoDaTecla(e.key, (e.target as HTMLElement | null)?.tagName)
      if (!acao) return
      e.preventDefault()
      if (acao === 'sair') { setAtiva(false); return }
      setAtual((a) => aplicar(acao, a, total))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [ativa, total])

  return { ativa, atual, ir, entrar, sair }
}
