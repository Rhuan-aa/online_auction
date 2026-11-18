import { useEffect, useRef, useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import { podeDarLance, proximoLance } from '../../palco/palco.ts'
import { VENDEDOR, type UsuarioId } from '../../usuarios.ts'
import { atrasos, iniciarExperimento, maximo, media, type Custo, type Experimento, type Snapshot } from './experimento.ts'

const DURACAO_S = 30
const MIN_INTERVALO = 250

interface Props { estado: EstadoLeilao | null; incrementoMinimo: number; usuario: UsuarioId }

const ms = (n: number | null) => (n === null ? '—' : `${Math.round(n)} ms`)

function Resultado({ nome, unidade, custo, lista }: { nome: string; unidade: string; custo: Custo; lista: number[] }) {
  return (
    <div className="coluna-abc">
      <h3>{nome}</h3>
      <p>{unidade}: <strong>{custo.requisicoes}</strong></p>
      <p>Bytes (JSON): <strong>{custo.bytes}</strong></p>
      <p>Atraso médio: <strong>{ms(media(lista))}</strong></p>
      <p>Atraso máximo: <strong>{ms(maximo(lista))}</strong></p>
    </div>
  )
}

export default function ExperimentoRede({ estado, incrementoMinimo, usuario }: Props) {
  const [intervalo, setIntervalo] = useState('1000')
  const [restante, setRestante] = useState<number | null>(null) // null = parado
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const exp = useRef<Experimento | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const estadoRef = useRef(estado)
  useEffect(() => { estadoRef.current = estado }, [estado])

  function encerrar() {
    clearInterval(timer.current)
    if (exp.current) { setSnap(exp.current.snapshot()); exp.current.parar(); exp.current = null }
    setRestante(null)
  }
  useEffect(() => () => { clearInterval(timer.current); exp.current?.parar() }, [])

  const valorIntervalo = Number(intervalo)
  const intervaloOk = Number.isInteger(valorIntervalo) && valorIntervalo >= MIN_INTERVALO
  const rodando = restante !== null

  function iniciar() {
    if (!estado || !intervaloOk) return
    setAviso(null)
    setSnap(null)
    exp.current = iniciarExperimento(api, estado.leilaoId, valorIntervalo, () => {
      if (exp.current) setSnap(exp.current.snapshot())
    })
    let faltam = DURACAO_S
    setRestante(faltam)
    timer.current = setInterval(() => { faltam -= 1; if (faltam <= 0) encerrar(); else setRestante(faltam) }, 1000)
  }

  async function darLance() {
    const e = estadoRef.current
    if (!e || !exp.current) return
    const licitante = usuario === VENDEDOR ? 'licitante-1' : usuario
    const r = await api.darLance(e.leilaoId, { licitanteId: licitante, valor: proximoLance(e, incrementoMinimo) })
    if (r.tipo === 'aceito') { exp.current?.aceitou(r.versao); setAviso(null) }
    else setAviso('O lance não foi aceito; tente de novo.')
  }

  const permissao = podeDarLance(estado, Date.now())
  const atr = snap ? atrasos(snap.percepcoes) : null

  return (
    <section className="bloco-aba">
      <h2>Experimento: SSE × polling</h2>
      <p className="suave">Por {DURACAO_S} s, uma assinatura SSE e um laço de polling observam o mesmo leilão. Dê lances pelo botão abaixo e compare o atraso e o custo de cada via.</p>
      <div className="rajada-controles">
        <label>Intervalo do polling (ms, mínimo {MIN_INTERVALO})
          <input inputMode="numeric" value={intervalo} disabled={rodando} onChange={(e) => setIntervalo(e.target.value)} />
        </label>
        {!rodando
          ? <button type="button" onClick={iniciar} disabled={!estado || !intervaloOk}>▶ Iniciar ({DURACAO_S} s)</button>
          : <button type="button" onClick={encerrar}>■ Parar</button>}
        <button type="button" onClick={darLance} disabled={!rodando || !permissao.pode}>Dar lance agora</button>
        {rodando && <span className="config-grande">{restante} s</span>}
      </div>
      {!estado && <p className="aviso">Sem leilão em foco: escolha um leilão para rodar o experimento.</p>}
      {!intervaloOk && <p className="erro" role="alert">Informe um intervalo inteiro de pelo menos {MIN_INTERVALO} ms.</p>}
      {rodando && !permissao.pode && <p className="suave">Não dá para dar lance agora: {permissao.motivo}.</p>}
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      {snap && atr && (
        <>
          <div className="colunas-abc">
            <Resultado nome="SSE" unidade="Mensagens" custo={snap.sse} lista={atr.sse} />
            <Resultado nome="Polling" unidade="Requisições" custo={snap.polling} lista={atr.polling} />
          </div>
          <p className="suave">Atraso não medido: {atr.naoMedidos} lances de outras janelas. {rodando ? 'Medindo…' : 'Experimento encerrado.'}</p>
        </>
      )}
    </section>
  )
}
