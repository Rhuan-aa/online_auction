import { useEffect, useReducer, useRef, useState } from 'react'
import { api, type EstadoLeilao } from '../../api.ts'
import { podeDarLance, proximoLance, type EventoVisto } from '../../palco/palco.ts'
import { hrefDe } from '../../rota.ts'
import Aba from '../../shell/Aba.tsx'
import { VENDEDOR, type UsuarioId } from '../../usuarios.ts'
import { ADRS } from './adrs.ts'
import { luzDoCaminho } from './caminho.ts'
import Diagrama from './Diagrama.tsx'
import Saude from './Saude.tsx'
import { INICIAL, reduzir, visao } from './tentativa.ts'

const PORQUE = (
  <p>
    A escrita só grava e publica; quem consome lê do Kafka no seu ritmo. Se o agendador ou as notificações caírem, o
    lance continua sendo aceito (ADR-001, ADR-004).
  </p>
)
const LIMITE_SSE_MS = 5000

interface Props {
  pergunta: string
  agora: number
  estado: EstadoLeilao | null
  incrementoMinimo: number | null
  usuario: UsuarioId
  ultimoEvento: EventoVisto | null
  leilaoId: string | null
}

export default function AbaArquitetura({ pergunta, agora, estado, incrementoMinimo, usuario, ultimoEvento, leilaoId }: Props) {
  const [montadoEm] = useState(Date.now) // eventos anteriores à abertura da aba não acendem o diagrama
  const [s, despachar] = useReducer(reduzir, INICIAL)
  const eventoRef = useRef(ultimoEvento)
  const tratado = useRef<EventoVisto | null>(null)

  useEffect(() => {
    eventoRef.current = ultimoEvento
    if (!ultimoEvento || ultimoEvento === tratado.current || ultimoEvento.quando < montadoEm) return
    tratado.current = ultimoEvento
    despachar({ tipo: 'sse', versao: ultimoEvento.versao, quando: ultimoEvento.quando })
  }, [ultimoEvento, montadoEm])

  const v = visao(s)
  const versaoEsperada = s.tentativa?.situacao === 'aceita' && s.tentativa.versao !== undefined
    && s.medicoes.some((m) => m.versao === s.tentativa?.versao && m.sseEm === null) ? s.tentativa.versao : null
  useEffect(() => {
    if (versaoEsperada === null) return
    const t = setTimeout(() => despachar({ tipo: 'expirou', versao: versaoEsperada }), LIMITE_SSE_MS)
    return () => clearTimeout(t)
  }, [versaoEsperada])

  async function acompanhar() {
    if (!estado || incrementoMinimo === null) return
    const licitanteId = usuario === VENDEDOR ? 'licitante-1' : usuario
    const cliqueEm = Date.now()
    despachar({ tipo: 'clique', em: cliqueEm })
    const r = await api.darLance(estado.leilaoId, { licitanteId, valor: proximoLance(estado, incrementoMinimo) })
    if (r.tipo !== 'aceito') {
      despachar({ tipo: 'recusado', mensagem: r.tipo === 'recusado' ? `Lance recusado: ${r.mensagem ?? r.codigo ?? 'regra violada'}`
        : r.tipo === 'conflito' ? 'Conflito de versão: outro lance chegou antes' : 'Erro ao enviar o lance' })
      return
    }
    const ev = eventoRef.current // o SSE pode chegar antes da resposta do POST
    const sseEm = ev && ev.versao === r.versao && ev.quando >= cliqueEm ? ev.quando : null
    despachar({ tipo: 'aceito', versao: r.versao, respostaEm: Date.now(), sseEm })
  }

  const permissao = podeDarLance(estado, agora)

  return (
    <Aba pergunta={pergunta} adr="ADR-001" porQue={PORQUE}>
      <section className="bloco-aba">
        <h2>O caminho de um lance</h2>
        <div className="rajada-controles">
          <button type="button" className="botao botao--destaque" onClick={() => void acompanhar()} disabled={s.tentativa?.situacao === 'gravando' || !estado || incrementoMinimo === null || !permissao.pode}>
            Dar lance e acompanhar
          </button>
          {!permissao.pode && <span className="suave">{permissao.motivo}</span>}
        </div>
        <Diagrama chave={`${s.tentativa?.cliqueEm ?? 0}-${s.externoEm ?? 0}`} luz={luzDoCaminho(v.fase)} gravacaoMs={v.gravacaoMs} propagacaoMs={v.propagacaoMs} />
        {v.mensagem && <p className="aviso" role="alert">{v.mensagem}</p>}
        {v.nota && <p className="aviso" role="alert">{v.nota}</p>}
        {v.fase === 'externo' && <p className="suave">Lance de outra janela: o evento chegou por Kafka, leitura e SSE (sem tempo medido).</p>}
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
