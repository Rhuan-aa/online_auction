import { useEffect, type ReactNode } from 'react'

/** Painel que desliza da esquerda por cima do conteúdo; Esc, o fundo ou o botão fecham. */
export default function Gaveta({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const aoTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') aoFechar() }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [aoFechar])

  return (
    <>
      <div className="gaveta-fundo" onClick={aoFechar} />
      <aside className="gaveta gaveta-lateral" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="gaveta-cabecalho">
          <h2>{titulo}</h2>
          <button className="botao" onClick={aoFechar} aria-label="Fechar">✕</button>
        </div>
        {children}
      </aside>
    </>
  )
}
