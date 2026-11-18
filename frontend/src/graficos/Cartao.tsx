/** Cartão que aparece ao passar o mouse num gráfico: nome, valor, conversão, posição ou a lista de séries. */
export default function Cartao({ x, y, cor, nome, grupo, valor, extra, posicao, linhas }: {
  x: number; y: number; cor?: string; nome: string; grupo?: string; valor?: string; extra?: string | null
  posicao?: string | null; linhas?: { nome: string; cor?: string; valor: string }[]
}) {
  return (
    <div className={`grafico-cartao${y < 150 ? ' grafico-cartao--abaixo' : ''}`} style={{ left: x, top: y }} role="status">
      <div className="grafico-cartao-nome"><span className="grafico-chave" style={{ background: cor }} aria-hidden="true" />{nome}</div>
      {grupo && <div className="grafico-cartao-grupo">{grupo}</div>}
      {valor && <div className="grafico-cartao-valor">{valor}</div>}
      {extra && <div className="grafico-cartao-extra">{extra}</div>}
      {posicao && <div className="grafico-cartao-posicao">{posicao}</div>}
      {linhas && (
        <ul className="grafico-cartao-linhas">
          {linhas.map((l) => (
            <li key={l.nome}><span className="grafico-chave" style={{ background: l.cor }} aria-hidden="true" />{l.nome}<b>{l.valor}</b></li>
          ))}
        </ul>
      )}
    </div>
  )
}
