import { useId, useState, type FormEvent } from 'react'
import { useDicaDispensavel } from './dicas.ts'
import { CAMPOS, PADRAO, validar, type Campos } from './formulario.ts'
import type { Parametros } from './tipos.ts'

interface Props {
  rodando: boolean
  ocupado: boolean // iniciando ou parando: os dois botões ficam desabilitados
  erro: string | null
  emAndamento: boolean // o serviço recusou porque já há uma corrida rodando (409)
  aoAcompanhar: () => void
  aoPararEmAndamento: () => void
  aoIniciar: (p: Parametros) => void
  aoParar: () => void
}

/** Os 6 campos da simulação, cada um com um tooltip (hover e foco), e o botão Iniciar / Parar. */
export default function Formulario({ rodando, ocupado, erro, emAndamento, aoAcompanhar, aoPararEmAndamento, aoIniciar, aoParar }: Props) {
  const dica = useDicaDispensavel()
  const [campos, setCampos] = useState<Campos>(PADRAO)
  const [invalido, setInvalido] = useState<string | null>(null)
  const base = useId()

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (rodando || ocupado) return
    const r = validar(campos)
    if (typeof r === 'string') { setInvalido(r); return }
    setInvalido(null)
    aoIniciar(r)
  }

  const mensagem = invalido ?? erro

  return (
    <form className="painel formulario-corrida" onSubmit={enviar} noValidate {...dica.atributo}
      onKeyDown={dica.aoTeclar} onFocus={dica.reexibir}>
      <fieldset className="campos" disabled={rodando || ocupado}>
        <legend className="visualmente-oculto">Parâmetros da corrida</legend>
        {CAMPOS.map((c) => {
          const id = `${base}-${c.campo}`
          return (
            <div className="campo" key={c.campo} onMouseEnter={dica.reexibir}>
              <label htmlFor={id}>
                {c.rotulo}
                <span className="campo-info" aria-hidden="true">?</span>
              </label>
              <input id={id} inputMode={c.dinheiro ? 'decimal' : 'numeric'} autoComplete="off"
                value={campos[c.campo]} aria-describedby={`${id}-dica`}
                onChange={(e) => setCampos({ ...campos, [c.campo]: e.target.value })} />
              <span role="tooltip" id={`${id}-dica`} className="dica">{c.dica}</span>
            </div>
          )
        })}
      </fieldset>
      <div className="formulario-acoes">
        {rodando
          ? <button type="button" className="botao botao--perigo botao--grande" onClick={aoParar} disabled={ocupado}>■ Parar</button>
          : <button type="submit" className="botao botao--destaque botao--grande" disabled={ocupado}>▶ Iniciar corrida</button>}
        {mensagem && <p className="alerta" role="alert">{mensagem}</p>}
        {emAndamento && !rodando && (
          <>
            <button type="button" className="botao" onClick={aoAcompanhar} disabled={ocupado}>Acompanhar a corrida em andamento</button>
            <button type="button" className="botao botao--perigo" onClick={aoPararEmAndamento} disabled={ocupado}>■ Parar</button>
          </>
        )}
      </div>
    </form>
  )
}
