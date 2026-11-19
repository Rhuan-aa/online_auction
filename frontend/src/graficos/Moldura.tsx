import type { ReactNode, Ref } from 'react'

interface ItemLegenda {
  nome: string
  cor: string
}

/**
 * Figura com título visível, unidade, legenda (se houver mais de uma série), estado vazio e a caixa
 * "O que isso quer dizer". A legenda é interativa: passar o mouse destaca a série; clicar fixa o destaque.
 */
export default function Moldura({ titulo, unidade, legenda, vazio, medida, leitura, destaque, aoDestacar, fixo, aoFixar, children }: {
  titulo: string
  unidade?: string
  legenda?: ItemLegenda[]
  vazio?: boolean | string // true: "Sem dados ainda"; texto: a mensagem a mostrar
  medida?: Ref<HTMLElement>
  leitura?: string[]
  destaque?: string | null
  aoDestacar?: (nome: string | null) => void
  fixo?: string | null
  aoFixar?: (nome: string) => void
  children: ReactNode
}) {
  const interativa = Boolean(aoDestacar)
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
            <ul className="grafico-legenda" aria-label={interativa ? 'Legenda: clique para destacar uma arquitetura' : undefined}>
              {legenda.map((l) => {
                const apagada = destaque != null && destaque !== l.nome
                const conteudo = <><span className="grafico-chave" style={{ background: l.cor }} aria-hidden="true" />{l.nome}</>
                return (
                  <li key={l.nome} className={apagada ? 'apagada' : undefined}>
                    {interativa ? (
                      <button type="button" className="grafico-legenda-botao" aria-pressed={fixo === l.nome}
                        onMouseEnter={() => aoDestacar?.(l.nome)} onMouseLeave={() => aoDestacar?.(null)}
                        onFocus={() => aoDestacar?.(l.nome)} onBlur={() => aoDestacar?.(null)}
                        onClick={() => aoFixar?.(l.nome)}>
                        {conteudo}
                      </button>
                    ) : conteudo}
                  </li>
                )
              })}
            </ul>
          )}
          {leitura && leitura.length > 0 && (
            <div className="grafico-leitura">
              <strong>O que isso quer dizer</strong>
              <ul>{leitura.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </figure>
  )
}
