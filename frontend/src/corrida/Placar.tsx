import { useId } from 'react'
import Ms from './Ms.tsx'
import { useDicaDispensavel } from './dicas.ts'
import { CRITERIOS, detalheIntegridade, excluidas, vencedores } from './melhores.ts'
import { inteiro } from './medidas.ts'
import { corDe, NOTA_CRUD, RESSALVAS, type ArqFoto, type Foto } from './tipos.ts'

/** A tabela final: as 4 arquiteturas × critérios, com o melhor de cada coluna destacado. */
export default function Placar({ foto }: { foto: Foto | null }) {
  const final = foto !== null && !foto.rodando && foto.arquiteturas.some((a) => a.integridade)
  if (!final) {
    return <p className="painel placar-vazio">O placar aparece quando a corrida termina.</p>
  }
  const arqs = foto.arquiteturas
  const v = vencedores(arqs)
  const fora = excluidas(arqs)
  return (
    <>
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
            <tr key={a.id} className={fora.some((e) => e.indice === i) ? 'placar-fora' : undefined}>
              <th scope="row" style={{ borderLeftColor: corDe(a.id) }}>{a.nome}</th>
              {CRITERIOS.map((c) => {
                const melhor = v[c.id].has(i)
                return (
                  <td key={c.id} className={melhor ? 'placar-melhor' : undefined}>
                    {c.tempo ? <Ms v={c.valor(a)} /> : <ValorComUnidade texto={c.texto(a)} />}{c.id === 'espaco' && a.espaco && <small>{linhasDoEspaco(a.espaco)}</small>}{melhor && <span aria-hidden="true"> ★</span>}
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
    {fora.length > 0 && (
      <p className="placar-nota" role="note">
        Fora da disputa pelo ★: {fora.map((e) => `${e.nome} não concorre: ${e.motivo}`).join('; ')}.
      </p>
    )}
    <p className="placar-nota suave">{NOTA_CRUD}</p>
    <p className="placar-nota suave">{RESSALVAS}</p>
    </>
  )
}

/** "linhas 1 · eventos 0 · chaves Redis 0": o que foi medido em bytes, ao lado do número. */
function linhasDoEspaco(e: NonNullable<ArqFoto['espaco']>): string {
  return `linhas ${inteiro(e.linhas)} · eventos ${inteiro(e.eventos)} · chaves Redis ${inteiro(e.chavesRedis)}`
}

function Integridade({ a }: { a: ArqFoto }) {
  const id = useId()
  const dica = useDicaDispensavel()
  if (!a.integridade) return <span className="suave">—</span>
  const ok = a.integridade.ok
  return (
    <span className="com-dica" tabIndex={0} aria-describedby={id} {...dica.atributo}
      onKeyDown={dica.aoTeclar} onFocus={dica.reexibir} onMouseEnter={dica.reexibir}>
      <span className={ok ? 'sim' : 'nao'}>{ok ? '✓ correto' : '✗ incorreto'}</span>
      <span role="tooltip" id={id} className="dica">{detalheIntegridade(a.integridade)}</span>
    </span>
  )
}

/** Unidades longas (lances/s, op/lance) vão para uma linha menor embaixo do número, para a tabela caber. */
function ValorComUnidade({ texto }: { texto: string }) {
  const i = texto.lastIndexOf(' ')
  const unidade = i > 0 ? texto.slice(i + 1) : ''
  if (!unidade.includes('/')) return <>{texto}</>
  return <>{texto.slice(0, i)}<small className="unidade">{unidade}</small></>
}
