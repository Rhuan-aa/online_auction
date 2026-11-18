import type { ReactNode, Ref } from 'react'

export interface ItemLegenda {
  nome: string
  cor: string
}

/** Figura com título visível, unidade, legenda (se houver mais de uma série) e estado vazio. */
export default function Moldura({ titulo, unidade, legenda, vazio, medida, children }: {
  titulo: string
  unidade?: string
  legenda?: ItemLegenda[]
  vazio?: boolean | string // true: "Sem dados ainda"; texto: a mensagem a mostrar
  medida?: Ref<HTMLElement>
  children: ReactNode
}) {
  return (
    <figure className="grafico" ref={medida}>
      <figcaption className="grafico-titulo">
        <strong>{titulo}</strong>
        {unidade && <span className="grafico-unidade"> ({unidade})</span>}
      </figcaption>
      {vazio ? (
        <p className="grafico-vazio">{typeof vazio === 'string' ? vazio : 'Sem dados ainda'}</p>
      ) : (
        <>
          {children}
          {legenda && legenda.length > 1 && (
            <ul className="grafico-legenda">
              {legenda.map((l) => (
                <li key={l.nome}>
                  <span className="grafico-chave" style={{ background: l.cor }} aria-hidden="true" />
                  {l.nome}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </figure>
  )
}
