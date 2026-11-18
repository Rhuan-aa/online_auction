import type { ReactNode } from 'react'

interface Props { id: string; kicker: string; titulo: string; explicacao: ReactNode; children: ReactNode }

/** Uma seção da página: kicker, título grande, uma linha de explicação e o conteúdo. */
export default function Secao({ id, kicker, titulo, explicacao, children }: Props) {
  return (
    <section className="secao" id={id} aria-labelledby={`${id}-titulo`}>
      <header className="secao-cabecalho">
        <p className="secao-kicker">{kicker}</p>
        <h2 className="secao-titulo" id={`${id}-titulo`}>{titulo}</h2>
        <p className="secao-explicacao">{explicacao}</p>
      </header>
      {children}
    </section>
  )
}
