import { useId } from 'react'
import { CRITERIOS, detalheIntegridade, vencedores } from './melhores.ts'
import { inteiro } from './medidas.ts'
import { corDe, type ArqFoto, type Foto } from './tipos.ts'

/** A tabela final: as 6 arquiteturas × critérios, com o melhor de cada coluna destacado. */
export default function Placar({ foto }: { foto: Foto | null }) {
  const final = foto !== null && !foto.rodando && foto.arquiteturas.some((a) => a.integridade)
  if (!final) {
    return <p className="painel placar-vazio">O placar aparece quando a corrida termina.</p>
  }
  const arqs = foto.arquiteturas
  const v = vencedores(arqs)
  return (
    <div className="placar-rolagem" tabIndex={0} role="region" aria-label="Placar">
      <table className="placar">
        <caption className="visualmente-oculto">Placar da corrida; ★ marca o melhor valor de cada coluna</caption>
        <thead>
          <tr>
            <th scope="col">Arquitetura</th>
            {CRITERIOS.map((c) => (
              <th key={c.id} scope="col">{c.rotulo}<small>{c.sentido === 'menor' ? 'menor é melhor' : 'maior é melhor'}</small></th>
            ))}
            <th scope="col">Integridade</th>
            <th scope="col">Histórico e viagem no tempo</th>
          </tr>
        </thead>
        <tbody>
          {arqs.map((a, i) => (
            <tr key={a.id}>
              <th scope="row" style={{ borderLeftColor: corDe(a.id) }}>{a.nome}</th>
              {CRITERIOS.map((c) => {
                const melhor = v[c.id].has(i)
                return (
                  <td key={c.id} className={melhor ? 'placar-melhor' : undefined}>
                    {c.texto(a)}{melhor && <span aria-hidden="true"> ★</span>}
                    {melhor && <span className="visualmente-oculto"> (melhor)</span>}
                  </td>
                )
              })}
              <td><Integridade a={a} /></td>
              <td>
                {a.auditoria?.suporta
                  ? <span className="sim">✓ suporta <small>({inteiro(a.auditoria.eventos)} eventos)</small></span>
                  : <span className="nao">não</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Integridade({ a }: { a: ArqFoto }) {
  const id = useId()
  if (!a.integridade) return <span className="suave">—</span>
  const ok = a.integridade.ok
  return (
    <span className="com-dica" tabIndex={0} aria-describedby={id}>
      <span className={ok ? 'sim' : 'nao'}>{ok ? '✓ correto' : '✗ incorreto'}</span>
      <span role="tooltip" id={id} className="dica">{detalheIntegridade(a.integridade)}</span>
    </span>
  )
}
