import type { ReactNode } from 'react'
import Slide from './Slide.tsx'

interface Props {
  /** A decisão citada, por exemplo "ADR-002". */
  adr?: string
  titulo?: ReactNode
  /** O texto da explicação (o mesmo da antiga caixa "Por que funciona assim?"). */
  children: ReactNode
}

/** Último passo de cada seção: slide largo com a explicação em destaque e a ADR citada. */
export default function PorQue({ adr, titulo = 'Por que funciona assim?', children }: Props) {
  return (
    <Slide layout="largo" titulo={titulo}>
      <div className="porque-slide">
        <div className="porque-texto">{children}</div>
        {adr && (
          <p className="porque-citacao">
            <span>decisão registrada</span>
            <span className="id porque-adr-id">{adr}</span>
          </p>
        )}
      </div>
    </Slide>
  )
}
