import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import { podeDarLance, proximoLance } from '../../palco/palco.ts'
import { VENDEDOR, type UsuarioId } from '../../usuarios.ts'
import { atrasos, estadoDoExperimento, iniciarExperimento, maximo, media, type Custo, type Experimento, type Snapshot } from './experimento.ts'

const DURACAO_S = 30
const MIN_INTERVALO = 250

interface Props { estado: EstadoLeilao | null; incrementoMinimo: number | null; usuario: UsuarioId }

const ms = (n: number | null) => (n === null ? '—' : `${Math.round(n)} ms`)

function Resultado({ nome, unidade, rotuloBytes, custo, lista }: { nome: string; unidade: string; rotuloBytes: string; custo: Custo; lista: number[] }) {
  return (
    <div className="coluna-abc">
      <h3>{nome}</h3>
      <p>{unidade}: <strong>{custo.requisicoes}</strong></p>
      <p>{rotuloBytes}: <strong>{custo.bytes}</strong></p>
      <p>Atraso médio desde o envio do lance: <strong>{ms(media(lista))}</strong></p>
      <p>Atraso máximo desde o envio do lance: <strong>{ms(maximo(lista))}</strong></p>
    </div>
  )
}

export default function ExperimentoRede({ estado, incrementoMinimo, usuario }: Props) {
  const [intervalo, setIntervalo] = useState('1000')
  const [fimEm, setFimEm] = useState<number | null>(null) // null = parado
  const [agora, setAgora] = useState(0)
  const [leilaoExp, setLeilaoExp] = useState<string | null>(null)
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const exp = useRef<Experimento | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const estadoRef = useRef(estado)
  useEffect(() => { estadoRef.current = estado }, [estado])

  const encerrar = useCallback((nota?: string) => {
    clearInterval(timer.current)
    if (exp.current) { setSnap(exp.current.snapshot()); exp.current.parar(); exp.current = null }
    setFimEm(null)
    if (nota) setAviso(nota)
  }, [])
  useEffect(() => () => { clearInterval(timer.current); exp.current?.parar() }, [])

  const rodando = fimEm !== null
  // O foco do palco mudou para outro leilão: o experimento termina e o resultado fica na tela.
  useEffect(() => {
    if (rodando && estado && leilaoExp && estado.leilaoId !== leilaoExp) {
      encerrar('Experimento encerrado: o leilão em foco mudou.')
    }
  }, [rodando, estado, leilaoExp, encerrar])

  const valorIntervalo = Number(intervalo)
  const intervaloOk = Number.isInteger(valorIntervalo) && valorIntervalo >= MIN_INTERVALO

  function iniciar() {
    if (!estado || !intervaloOk) return
    const inicio = Date.now()
    setAviso(null)
    setSnap(null)
    setLeilaoExp(estado.leilaoId)
    exp.current = iniciarExperimento(api, estado.leilaoId, valorIntervalo, () => {
      if (exp.current) setSnap(exp.current.snapshot())
    })
    setAgora(inicio)
    setFimEm(inicio + DURACAO_S * 1000)
    timer.current = setInterval(() => {
      const t = Date.now()
      if (t >= inicio + DURACAO_S * 1000) encerrar()
      else setAgora(t)
    }, 250)
  }

  // Sempre no leilão medido, com a versão e o incremento mais recentes dele.
  const estadoMedido = leilaoExp ? estadoDoExperimento(leilaoExp, estado) : null

  async function darLance() {
    const e = leilaoExp ? estadoDoExperimento(leilaoExp, estadoRef.current) : null
    const atual = exp.current
    if (!e || !atual || incrementoMinimo === null) return
    const licitante = usuario === VENDEDOR ? 'licitante-1' : usuario
    const envioEm = Date.now() // o atraso conta desde o envio
    const r = await api.darLance(atual.leilaoId, { licitanteId: licitante, valor: proximoLance(e, incrementoMinimo) })
    if (r.tipo === 'aceito') { atual.aceitou(r.versao, envioEm); setAviso(null) }
    else setAviso('O lance não foi aceito; tente de novo.')
  }

  const restante = fimEm === null ? null : Math.max(0, Math.ceil((fimEm - agora) / 1000))
  const permissao = podeDarLance(estadoMedido, Date.now())
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
          : <button type="button" onClick={() => encerrar()}>■ Parar</button>}
        <button type="button" onClick={darLance} disabled={!rodando || !estadoMedido || !permissao.pode || incrementoMinimo === null}>Dar lance agora</button>
        {rodando && <span className="config-grande">{restante} s</span>}
      </div>
      {!estado && <p className="aviso">Sem leilão em foco: escolha um leilão para rodar o experimento.</p>}
      {!intervaloOk && <p className="erro" role="alert">Informe um intervalo inteiro de pelo menos {MIN_INTERVALO} ms.</p>}
      {rodando && !permissao.pode && <p className="suave">Não dá para dar lance agora: {permissao.motivo}.</p>}
      {aviso && <p className="aviso" role="alert">{aviso}</p>}
      {snap && atr && (
        <>
          <div className="colunas-abc">
            <Resultado nome="SSE" unidade="Mensagens" rotuloBytes="Bytes" custo={snap.sse} lista={atr.sse} />
            <Resultado nome="Polling" unidade="Requisições" rotuloBytes="Bytes (JSON da resposta)" custo={snap.polling} lista={atr.polling} />
          </div>
          <p className="suave">Atraso não medido: {atr.naoMedidos} lances de outras janelas (ou sem medida válida). {rodando ? 'Medindo…' : 'Experimento encerrado.'}</p>
        </>
      )}
    </section>
  )
}
