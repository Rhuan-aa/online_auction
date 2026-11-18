import type { ReactNode } from 'react'
import Slide from './Slide.tsx'

interface Props {
  pergunta: string
  adr?: string
  porQue: ReactNode
  children?: ReactNode
}

/**
 * Seção ainda não convertida em passos: a aba inteira num slide largo só (passo 1), com o
 * conteúdo e a caixa "Por que funciona assim?" rolando dentro do palco visual.
 */
export default function Aba({ pergunta, adr, porQue, children }: Props) {
  return (
    <Slide layout="largo" titulo={pergunta}>
      <div className="aba">
        <div className="aba-conteudo">{children}</div>
        <aside className="gaveta porque">
          <h2>Por que funciona assim?{adr && <span className="id porque-adr">{adr}</span>}</h2>
          <div>{porQue}</div>
        </aside>
      </div>
    </Slide>
  )
}
