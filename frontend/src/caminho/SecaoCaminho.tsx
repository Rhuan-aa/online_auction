import { useEffect, useReducer, useRef, useState } from 'react'
import { api } from '../api.ts'
import { licitanteDaVez, podeDarLance, proximoLance, type EventoVisto } from '../leilao/regras.ts'
import { useAgora } from '../leilao/useAgora.ts'
import type { Leilao } from '../leilao/useLeilao.ts'
import { luzDoCaminho } from './caminho.ts'
import Diagrama from './Diagrama.tsx'
import { INICIAL, reduzir, visao } from './tentativa.ts'

const LIMITE_SSE_MS = 5000

/**
 * "Dar lance e acompanhar": manda um lance real ao 8081 e mede a gravação (clique → resposta) e a
 * propagação (resposta → chegada do SSE da leitura, 8082). Remontado a cada leilão (key no App).
 */
export default function SecaoCaminho({ leilao }: { leilao: Leilao }) {
  const { estado, incrementoMinimo, precoInicial, ultimoEvento } = leilao
  const agora = useAgora(estado?.status === 'ABERTO')
  const [montadoEm] = useState(Date.now) // eventos anteriores à montagem não acendem o diagrama
  const [s, despachar] = useReducer(reduzir, INICIAL)
  const eventoRef = useRef<EventoVisto | null>(ultimoEvento)
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
    const cliqueEm = Date.now()
    despachar({ tipo: 'clique', em: cliqueEm })
    const r = await api.darLance(estado.leilaoId, {
      licitanteId: licitanteDaVez(estado.liderId), valor: proximoLance(estado, incrementoMinimo, precoInicial),
    })
    if (r.tipo !== 'aceito') {
      despachar({
        tipo: 'recusado',
        mensagem: r.tipo === 'recusado' ? `Lance recusado: ${r.mensagem ?? r.codigo ?? 'regra violada'}`
          : r.tipo === 'conflito' ? 'Conflito de versão: outro lance chegou antes'
            : r.status === 0 ? 'Serviço de escrita (8081) fora do ar' : `Erro ao enviar o lance (${r.status})`,
      })
      return
    }
    const ev = eventoRef.current // o SSE pode chegar antes da resposta do POST
    const sseEm = ev && ev.versao === r.versao && ev.quando >= cliqueEm ? ev.quando : null
    despachar({ tipo: 'aceito', versao: r.versao, respostaEm: Date.now(), sseEm })
  }

  const permissao = podeDarLance(estado, agora)
  const desabilitado = s.tentativa?.situacao === 'gravando' || !estado || incrementoMinimo === null || !permissao.pode

  return (
    <div className="caminho">
      <div className="caminho-acao">
        <button type="button" className="botao botao--destaque botao--grande" onClick={() => void acompanhar()} disabled={desabilitado}>
          Dar lance e acompanhar
        </button>
        {!permissao.pode && <span className="suave">{permissao.motivo}</span>}
        {permissao.pode && incrementoMinimo === null && <span className="suave">Lendo o incremento mínimo do leilão…</span>}
        {v.mensagem && <p className="aviso" role="alert">{v.mensagem}</p>}
        {v.nota && <p className="aviso" role="alert">{v.nota}</p>}
        {v.fase === 'externo' && <p className="suave">Lance de outra janela: o evento chegou por Kafka, leitura e SSE (sem tempo medido).</p>}
      </div>
      <Diagrama chave={`${s.tentativa?.cliqueEm ?? 0}-${s.externoEm ?? 0}`} luz={luzDoCaminho(v.fase)} gravacaoMs={v.gravacaoMs} propagacaoMs={v.propagacaoMs} />
      <p className="suave">Os dois tempos são medidos neste navegador; os nós do meio não têm tempo próprio.</p>
    </div>
  )
}
