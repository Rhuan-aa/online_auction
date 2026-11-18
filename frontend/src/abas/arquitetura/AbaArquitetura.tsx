import { useEffect, useRef, useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import { podeDarLance, proximoLance, type EventoVisto } from '../../palco/palco.ts'
import { hrefDe } from '../../rota.ts'
import Aba from '../../shell/Aba.tsx'
import { VENDEDOR, type UsuarioId } from '../../usuarios.ts'
import { ADRS } from './adrs.ts'
import { casarSse, luzDoCaminho, trechos, type Fase, type Medicao } from './caminho.ts'
import Diagrama from './Diagrama.tsx'
import Saude from './Saude.tsx'

const PORQUE = (
  <p>
    A escrita só grava e publica; quem consome lê do Kafka no seu ritmo. Se o agendador ou as notificações caírem, o
    lance continua sendo aceito (ADR-001, ADR-004).
  </p>
)
const LIMITE_SSE_MS = 5000
const MAX_MEDICOES = 10

interface Props {
  pergunta: string
  estado: EstadoLeilao | null
  incrementoMinimo: number | null
  usuario: UsuarioId
  ultimoEvento: EventoVisto | null
  leilaoId: string | null
}

export default function AbaArquitetura({ pergunta, estado, incrementoMinimo, usuario, ultimoEvento, leilaoId }: Props) {
  const [montadoEm] = useState(Date.now) // eventos anteriores à abertura da aba não acendem o diagrama
  const [medicoes, setMedicoes] = useState<Medicao[]>([])
  const [emVoo, setEmVoo] = useState(false)
  const [resultado, setResultado] = useState<string | null>(null)
  const [expirada, setExpirada] = useState<number | null>(null)
  const eventoRef = useRef(ultimoEvento)
  const tratado = useRef<EventoVisto | null>(null)

  useEffect(() => {
    eventoRef.current = ultimoEvento
    if (!ultimoEvento || ultimoEvento === tratado.current || ultimoEvento.quando < montadoEm) return
    tratado.current = ultimoEvento
    setMedicoes((p) => casarSse(p, ultimoEvento.versao, ultimoEvento.quando))
  }, [ultimoEvento, montadoEm])

  const atual = medicoes.length ? medicoes[medicoes.length - 1] : null
  const versaoEsperada = atual && atual.respostaEm !== null && atual.sseEm === null ? atual.versao : null
  useEffect(() => {
    if (versaoEsperada === null) return
    const t = setTimeout(() => setExpirada(versaoEsperada), LIMITE_SSE_MS)
    return () => clearTimeout(t)
  }, [versaoEsperada])

  async function acompanhar() {
    if (!estado || incrementoMinimo === null) return
    const licitanteId = usuario === VENDEDOR ? 'licitante-1' : usuario
    const cliqueEm = Date.now()
    setEmVoo(true)
    setResultado(null)
    const r = await api.darLance(estado.leilaoId, { licitanteId, valor: proximoLance(estado, incrementoMinimo) })
    setEmVoo(false)
    if (r.tipo !== 'aceito') {
      setResultado(r.tipo === 'recusado' ? `Lance recusado: ${r.mensagem ?? r.codigo ?? 'regra violada'}`
        : r.tipo === 'conflito' ? 'Conflito de versão: outro lance chegou antes' : 'Erro ao enviar o lance')
      return
    }
    const ev = eventoRef.current // o SSE pode chegar antes da resposta do POST
    const sseEm = ev && ev.versao === r.versao && ev.quando >= cliqueEm ? ev.quando : null
    setMedicoes((p) => [...p, { versao: r.versao, cliqueEm, respostaEm: Date.now(), sseEm }].slice(-MAX_MEDICOES))
  }

  const ultimoMomento = atual ? (atual.sseEm ?? atual.respostaEm ?? atual.cliqueEm) : 0
  const externo = ultimoEvento !== null && ultimoEvento.quando >= montadoEm
    && !medicoes.some((m) => m.versao === ultimoEvento.versao) && ultimoEvento.quando > ultimoMomento
  let fase: Fase | null = null
  if (emVoo) fase = 'gravando'
  else if (externo) fase = 'externo'
  else if (atual?.respostaEm != null) fase = atual.sseEm !== null ? 'completo' : 'gravado'
  const t = fase && fase !== 'externo' && atual ? trechos(atual) : { gravacaoMs: null, propagacaoMs: null }
  const permissao = podeDarLance(estado, Date.now())

  return (
    <Aba pergunta={pergunta} adr="ADR-001" porQue={PORQUE}>
      <section className="bloco-aba">
        <h2>O caminho de um lance</h2>
        <div className="rajada-controles">
          <button type="button" onClick={() => void acompanhar()} disabled={emVoo || !estado || incrementoMinimo === null || !permissao.pode}>
            Dar lance e acompanhar
          </button>
          {!permissao.pode && <span className="suave">{permissao.motivo}</span>}
        </div>
        <Diagrama luz={luzDoCaminho(fase)} gravacaoMs={t.gravacaoMs} propagacaoMs={t.propagacaoMs} />
        {resultado && <p className="aviso" role="alert">{resultado}</p>}
        {versaoEsperada !== null && expirada === versaoEsperada && <p className="aviso" role="alert">SSE não chegou em 5 s</p>}
        {fase === 'externo' && <p className="suave">Lance de outra janela: o evento chegou por Kafka, leitura e SSE (sem tempo medido).</p>}
        <p className="suave">Os dois tempos são medidos neste navegador; os nós do meio não têm tempo próprio.</p>
      </section>

      <Saude />

      <section className="bloco-aba">
        <h2>Decisões de arquitetura</h2>
        <div className="adr-grade">
          {ADRS.map((a) => (
            <a key={a.id} className="adr-cartao" href={hrefDe({ aba: a.aba, leilaoId })}>
              <span className="id">{a.id}</span>
              <strong>{a.titulo}</strong>
              <span>{a.decisao}</span>
            </a>
          ))}
        </div>
      </section>
    </Aba>
  )
}
