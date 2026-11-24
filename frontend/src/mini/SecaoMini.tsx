import { useEffect, useState } from 'react'
import { api, ErroHttp, type EstadoLeilao, type Notificacao } from '../api.ts'
import { dinheiro } from '../formato.ts'
import { fimDoLeilao, podeDarLance } from '../leilao/regras.ts'
import { useAgora } from '../leilao/useAgora.ts'
import { useLeilao } from '../leilao/useLeilao.ts'
import {
  avisoAtual, INCREMENTO, LICITANTES, nomeDe, PRAZO_MINI_MS, PRECO_INICIAL, ROTULO_SITUACAO, situacaoDe,
  valorDoLance, VENDEDOR_MINI,
} from './regras.ts'

/** Os avisos de uma pessoa, assinados enquanto `ativo` (o SSE só entrega o que chega depois de assinar). */
function useNotificacoes(pessoaId: string, ativo: boolean): Notificacao[] {
  const [lista, setLista] = useState<Notificacao[]>([])
  useEffect(() => {
    if (!ativo) return
    return api.observarNotificacoes(pessoaId, (n) => setLista((l) => [...l.slice(-19), n]))
  }, [pessoaId, ativo])
  return lista
}

interface PropsTela {
  id: string
  nome: string
  estado: EstadoLeilao | null
  agora: number
  deuLance: boolean
  notificacoes: Notificacao[]
  aoDarLance: (id: string) => Promise<string | null>
}

function TelaLicitante({ id, nome, estado, agora, deuLance, notificacoes, aoDarLance }: PropsTela) {
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState<string | null>(null)
  const situacao = situacaoDe(estado, id, deuLance)
  const aviso = avisoAtual(notificacoes, estado?.leilaoId ?? null, situacao)
  const lidera = estado?.liderId === id && estado.status === 'ABERTO'
  const pode = estado !== null && podeDarLance(estado, agora).pode && !lidera && !enviando

  async function lance() {
    setEnviando(true)
    setFalha(await aoDarLance(id))
    setEnviando(false)
  }

  return (
    <article className={`mini-tela mini-tela--${situacao}`} aria-label={`Tela de ${nome}`}>
      <header className="mini-tela-topo">
        <span className="mini-avatar" aria-hidden="true">{nome[0]}</span>
        <strong>{nome}</strong>
        <span className="mini-situacao">{ROTULO_SITUACAO[situacao]}</span>
      </header>
      <button type="button" className="botao botao--destaque mini-lance" disabled={!pode} onClick={() => void lance()}>
        {enviando ? 'Enviando…' : lidera ? 'Você lidera'
          : estado?.status === 'ENCERRADO' ? 'Leilão encerrado' : estado ?`Dar lance de ${dinheiro(valorDoLance(estado))}` : 'Dar lance'}
      </button>
      {falha && <p className="erro">{falha}</p>}
      <div className="mini-avisos" aria-live="polite" aria-label={`Aviso para ${nome}`}>
        {aviso && (
          <p key={notificacoes.indexOf(aviso)} className={`mini-aviso mini-aviso--${aviso.tipo.toLowerCase()}`}>
            <span aria-hidden="true">{aviso.tipo === 'SUPERADO' ? '🔔' : '🏆'}</span> {aviso.mensagem}
          </p>
        )}
      </div>
    </article>
  )
}

function Palco({ estado, agora }: { estado: EstadoLeilao | null; agora: number }) {
  if (!estado) return <div className="mini-palco"><p className="suave">Comece um mini leilão para ver a disputa.</p></div>
  const encerrado = estado.status === 'ENCERRADO'
  const fim = fimDoLeilao(estado, agora)
  return (
    <div className={`mini-palco${encerrado ? ' mini-palco--fim' : ''}`} aria-live="polite">
      <span className="mini-rotulo">{encerrado ? 'Resultado final' : 'Maior lance'}</span>
      <span className="mini-valor">{estado.liderId ? dinheiro(estado.precoAtual) : '—'}</span>
      <span className="mini-lider">
        {estado.liderId ? `de ${nomeDe(estado.liderId)}` : estado.status === 'CRIADO' ? 'abrindo… (o agendador abre em segundos)' : 'ninguém deu lance ainda'}
      </span>
      {encerrado
        ? <p className="mini-anuncio">{estado.liderId ? `🏆 ${nomeDe(estado.liderId)} venceu com ${dinheiro(estado.precoAtual)}!` : 'Terminou sem lances.'}</p>
        : fim && <span className="fim-leilao">{fim}</span>}
    </div>
  )
}

/**
 * Seção 7: um leilão real de 30 segundos entre Ana e Bruno. O painel do meio vem do stream do leilão; os avisos
 * de cada tela vêm do Notificador (consumidor Kafka do leilao-leitura), entregues por SSE a cada pessoa.
 */
export default function SecaoMini() {
  const [miniId, setMiniId] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [deram, setDeram] = useState<Record<string, boolean>>({})
  const leilao = useLeilao(miniId)
  const estado = leilao.estado
  const agora = useAgora(estado?.status === 'ABERTO')
  const ativo = miniId !== null
  const avisosAna = useNotificacoes(LICITANTES[0].id, ativo)
  const avisosBruno = useNotificacoes(LICITANTES[1].id, ativo)
  const avisos: Record<string, Notificacao[]> = { ana: avisosAna, bruno: avisosBruno }

  async function comecar() {
    setCriando(true)
    setErro(null)
    try {
      const inicio = Date.now()
      const { leilaoId } = await api.criarLeilao({
        vendedorId: VENDEDOR_MINI, titulo: 'Mini leilão', precoInicial: PRECO_INICIAL, incrementoMinimo: INCREMENTO,
        inicioEm: new Date(inicio).toISOString(), fimEm: new Date(inicio + PRAZO_MINI_MS).toISOString(),
      })
      setDeram({})
      setMiniId(leilaoId)
    } catch (e) {
      setErro(e instanceof ErroHttp ? e.message : 'Serviço de escrita (8081) fora do ar.')
    } finally {
      setCriando(false)
    }
  }

  async function darLance(id: string): Promise<string | null> {
    if (!estado) return null
    const r = await api.darLance(estado.leilaoId, { licitanteId: id, valor: valorDoLance(estado) })
    if (r.tipo === 'aceito') {
      setDeram((d) => ({ ...d, [id]: true }))
      return null
    }
    if (r.tipo === 'recusado') return `Recusado: ${r.mensagem ?? r.codigo}`
    if (r.tipo === 'conflito') return 'Outro lance chegou antes; tente de novo.'
    return r.status === 0 ? 'Serviço de escrita (8081) fora do ar.' : `Erro ${r.status}`
  }

  const emAndamento = estado !== null && (estado.status === 'ABERTO' || estado.status === 'CRIADO')

  return (
    <div className="mini">
      <div className="mini-controles">
        <button type="button" className="botao botao--destaque" onClick={() => void comecar()} disabled={criando || emAndamento}>
          {criando ? 'Criando…' : miniId ? 'Novo mini leilão' : 'Começar mini leilão (30 s)'}
        </button>
        <span className="suave">
          Lances a partir de {dinheiro(PRECO_INICIAL)}, de {dinheiro(INCREMENTO)} em {dinheiro(INCREMENTO)}. Pelo anti-sniping, lance com menos de 30 s restantes empurra o fim em +30 s.
        </span>
      </div>
      {erro && <p className="alerta" role="alert">{erro}</p>}
      <div className="mini-grade">
        {LICITANTES.map((l, i) => (
          <div key={l.id} className={i === 0 ? 'mini-col mini-col--esq' : 'mini-col mini-col--dir'}>
            <TelaLicitante id={l.id} nome={l.nome} estado={estado} agora={agora} deuLance={deram[l.id] ?? false}
              notificacoes={avisos[l.id]} aoDarLance={darLance} />
          </div>
        ))}
        <div className="mini-col mini-col--meio"><Palco estado={estado} agora={agora} /></div>
      </div>
      <p className="suave">
        Os avisos de cada tela não são calculados no navegador: vêm do Notificador do leilao-leitura, que consome o
        Kafka e entrega por SSE a cada pessoa. O painel do meio vem do stream do leilão.
      </p>
    </div>
  )
}
