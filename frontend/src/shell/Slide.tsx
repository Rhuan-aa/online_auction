import { useContext, useId, type ReactNode } from 'react'
import { kickerDe } from '../secoes.ts'
import { SlideContexto } from './contexto.ts'

export interface SlideProps {
  /** A pergunta grande do slide. */
  titulo: ReactNode
  /** "Pergunta 1 · passo 2/3 · …"; sem ele, vem do registro (secoes.ts) pela seção e passo do contexto. */
  kicker?: string
  /** Texto curto: o que acontece ao apertar o botão. */
  texto?: ReactNode
  /** Controles e o botão principal (CTA), embaixo do texto. */
  acao?: ReactNode
  /** dividido: texto à esquerda, visual à direita. largo: título em cima, visual na largura toda. */
  layout?: 'dividido' | 'largo'
  /** O "palco visual": gráfico, escada, diagrama… Fica num cartão translúcido que rola por dentro. */
  children?: ReactNode
}

/** Um slide em tela cheia. Cabe na área do slide sem rolar a página; cada coluna rola por dentro se precisar. */
export default function Slide({ titulo, kicker, texto, acao, layout = 'dividido', children }: SlideProps) {
  const onde = useContext(SlideContexto)
  const id = useId()
  return (
    <section className={`slide slide--${layout}`} aria-labelledby={id}>
      <div className="slide-texto">
        <p className="slide-kicker">{kicker ?? kickerDe(onde.aba, onde.passo)}</p>
        <h1 className="slide-titulo" id={id}>{titulo}</h1>
        {texto && <div className="slide-explicacao">{texto}</div>}
        {acao && <div className="slide-acao">{acao}</div>}
      </div>
      {children && <div className="slide-visual">{children}</div>}
    </section>
  )
}
