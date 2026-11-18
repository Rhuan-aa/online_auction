import { useEffect, useRef, useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import Slide from '../../shell/Slide.tsx'
import { mudancas, ROTULO_CAMPO, valorDoCampo } from './diferencas.ts'

interface Props { leilaoId: string; atual: number; versao: number; aoMudar: (v: number) => void }

interface Resultado { chave: string; estado: EstadoLeilao; anterior: EstadoLeilao | null }

/** Slider que pede ao servidor o estado em qualquer versão (a mesma `aplicar`, nada reimplementado aqui). */
export default function ViagemNoTempo({ leilaoId, atual, versao, aoMudar }: Props) {
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [erro, setErro] = useState<{ chave: string; msg: string } | null>(null)
  const cache = useRef(new Map<string, EstadoLeilao>()) // uma versão gravada nunca muda
  const chave = `${leilaoId}@${versao}`

  useEffect(() => {
    let vigente = true // descarta resposta de uma versão que já não é a escolhida
    const buscar = async (v: number) => {
      const k = `${leilaoId}@${v}`
      const guardado = cache.current.get(k)
      if (guardado) return guardado
      const e = await api.estadoNaVersao(leilaoId, v)
      cache.current.set(k, e)
      return e
    }
    const t = setTimeout(() => {
      setErro(null)
      Promise.all([buscar(versao), versao > 1 ? buscar(versao - 1) : Promise.resolve(null)])
        .then(([estado, anterior]) => { if (vigente) { setResultado({ chave, estado, anterior }); setErro(null) } })
        .catch((e: unknown) => { if (vigente) setErro({ chave, msg: e instanceof Error ? e.message : String(e) }) })
    }, 150)
    return () => { vigente = false; clearTimeout(t) }
  }, [leilaoId, versao, chave])

  const r = resultado // mantém o anterior na tela (esmaecido) até o novo chegar
  const atrasado = r !== null && r.chave !== chave
  const lista = r ? mudancas(r.anterior, r.estado) : []

  const classe = atrasado ? 'viagem viagem--carregando' : 'viagem'
  const acao = (
    <div className={classe}>
      <div className="viagem-controle">
        <button type="button" className="botao" aria-label="Versão anterior" disabled={versao <= 1} onClick={() => aoMudar(versao - 1)}>◀</button>
        <input type="range" min={1} max={atual} value={versao} aria-label="Versão" aria-valuetext={`versão ${versao} de ${atual}`} onChange={(e) => aoMudar(Number(e.target.value))} />
        <button type="button" className="botao" aria-label="Próxima versão" disabled={versao >= atual} onClick={() => aoMudar(versao + 1)}>▶</button>
        <strong className="id">v{versao} de {atual}</strong>
      </div>
      {erro?.chave === chave && <p role="alert" className="erro">{erro.msg}</p>}
      {r && (
        <dl className="viagem-estado">
          <dt>Título</dt><dd>{r.estado.titulo}</dd>
          <dt>Status</dt><dd>{valorDoCampo('status', r.estado.status)}</dd>
          <dt>Preço</dt><dd>{valorDoCampo('precoAtual', r.estado.precoAtual)}</dd>
          <dt>Líder</dt><dd>{valorDoCampo('liderId', r.estado.liderId)}</dd>
          <dt>Fim</dt><dd>{valorDoCampo('fimEm', r.estado.fimEm)}</dd>
        </dl>
      )}
    </div>
  )

  return (
    <Slide titulo="Voltar no tempo" texto={<p>Arraste a versão: o servidor refaz o estado naquele ponto, aplicando só os eventos até ela.</p>} acao={acao}>
      <div className={classe}>
        {!r && <p className="slide-vazio">O que mudou em cada versão aparece aqui.</p>}
        {r && (r.estado.versao === 1
          ? <p className="suave">Estado inicial</p>
          : lista.length === 0
            ? <p className="suave">Nada mudou em relação à versão {r.estado.versao - 1}.</p>
            : (
              <ul className="viagem-mudancas">
                {lista.map((m) => (
                  <li key={m.campo}>{ROTULO_CAMPO[m.campo]}: {valorDoCampo(m.campo, m.de)} → {valorDoCampo(m.campo, m.para)}</li>
                ))}
              </ul>
            ))}
      </div>
    </Slide>
  )
}
