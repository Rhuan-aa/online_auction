import type { ReactNode } from 'react'

interface Props {
  pergunta: string
  adr?: string
  porQue: ReactNode
  children?: ReactNode
}

/** Esqueleto comum das abas: a pergunta como título, o conteúdo e a caixa "Por que funciona assim?". */
export default function Aba({ pergunta, adr, porQue, children }: Props) {
  return (
    <section className="aba">
      <h1 className="pergunta">{pergunta}</h1>
      <div className="aba-conteudo">{children}</div>
      <aside className="gaveta porque">
        <h2>Por que funciona assim?{adr && <span className="id porque-adr">{adr}</span>}</h2>
        <div>{porQue}</div>
      </aside>
    </section>
  )
}
