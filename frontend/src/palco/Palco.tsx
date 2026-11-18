import { useEffect, useState, type FormEvent } from 'react'
import Confirmar from '../Confirmar.tsx'
import { api, ErroHttp, type EstadoLeilao } from '../api.ts'
import { dinheiro, paraCentavos, ROTULO_STATUS, tempoRestante } from '../formato.ts'
import { isVendedor, type UsuarioId } from '../usuarios.ts'
import { podeDarLance, proximoLance } from './palco.ts'
import type { Palco as DadosPalco } from './usePalco.ts'

interface Props {
  leilaoId: string | null
  palco: DadosPalco
  usuario: UsuarioId
  aoAbrirLeiloes: () => void
  aoAbrirNovo: () => void
}

type Aviso = { tipo: 'ok' | 'erro'; texto: string }

/** Relógio da tela: a hora atual, atualizada a cada segundo enquanto `ativo`. */
function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ativo])
  return agora
}

/** O backend avisa "Lance mínimo é 13000" (centavos): mostra em reais. */
function traduzirMensagem(codigo: string | undefined, mensagem: string | undefined): string {
  if (codigo === 'LANCE_ABAIXO_DO_MINIMO') {
    const centavos = mensagem?.match(/\d+/)?.[0]
    if (centavos) return `Lance abaixo do mínimo. O mínimo agora é ${dinheiro(Number(centavos))}.`
  }
  return mensagem ?? 'Lance recusado.'
}

/** 10500 → "105,00", o formato que o campo de lance aceita. */
const paraCampo = (centavos: number) => (centavos / 100).toFixed(2).replace('.', ',')

const ROTULO_SITUACAO = { 'ao-vivo': 'ao vivo', desatualizado: 'desatualizado', carregando: 'carregando', indisponivel: 'serviço indisponível', 'nao-encontrado': '', 'sem-leilao': '' }

export default function Palco({ leilaoId, palco, usuario, aoAbrirLeiloes, aoAbrirNovo }: Props) {
  const { estado, eventos, situacao, incrementoMinimo, precoInicial } = palco
  const agora = useAgora(estado?.status === 'ABERTO')
  const vendedor = isVendedor(usuario)

  return (
    <aside className="palco" aria-label="Leilão em foco">
      <div className="palco-seletor">
        <span className="id palco-id">{leilaoId ?? 'nenhum leilão'}</span>
        <button className="palco-link" onClick={aoAbrirLeiloes}>trocar ▾</button>
      </div>

      {situacao === 'sem-leilao' && (
        <div className="palco-vazio">
          <h2>Sem leilão em foco</h2>
          <p className="suave">Escolha um leilão para acompanhar ao vivo.</p>
          <button className="botao botao--destaque" onClick={aoAbrirLeiloes}>Ver leilões</button>
        </div>
      )}
      {situacao === 'nao-encontrado' && (
        <div className="palco-vazio">
          <h2>Leilão não encontrado</h2>
          <button className="botao botao--destaque" onClick={aoAbrirLeiloes}>Escolher outro leilão</button>
        </div>
      )}
      {situacao === 'carregando' && <p className="suave">Carregando…</p>}
      {situacao === 'indisponivel' && <p className="erro" role="alert">Serviço indisponível — tentando de novo</p>}

      {estado && (
        <CorpoPalco
          key={estado.leilaoId}
          estado={estado}
          agora={agora}
          usuario={usuario}
          vendedor={vendedor}
          desatualizado={situacao === 'desatualizado'}
          incrementoMinimo={incrementoMinimo}
          precoInicial={precoInicial}
        />
      )}

      {estado && (
        <section className="palco-eventos" aria-label="Últimos eventos">
          <h3>últimos eventos</h3>
          {eventos.length === 0
            ? <p className="suave">Nenhum evento ainda.</p>
            : (
              <ul>
                {eventos.map((e) => (
                  <li key={e.versao}><span className="id">v{e.versao}</span> {e.tipo}</li>
                ))}
              </ul>
            )}
        </section>
      )}

      <p className="palco-links">
        {vendedor && <><button className="palco-link" onClick={aoAbrirNovo}>+ novo leilão</button> · </>}
        <button className="palco-link" onClick={aoAbrirLeiloes}>ver todos</button>
      </p>
      <span className="visualmente-oculto" aria-live="polite">{ROTULO_SITUACAO[situacao]}</span>
    </aside>
  )
}

interface CorpoProps {
  estado: EstadoLeilao
  agora: number
  usuario: UsuarioId
  vendedor: boolean
  desatualizado: boolean
  incrementoMinimo: number | null
  precoInicial: number | null
}

function CorpoPalco({ estado, agora, usuario, vendedor, desatualizado, incrementoMinimo, precoInicial }: CorpoProps) {
  // O campo sugere o próximo lance; o que o usuário digitou vale só para a versão em que digitou.
  const [editado, setEditado] = useState<{ versao: number; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [precoNaEntrada] = useState(estado.precoAtual) // não pulsa na primeira exibição

  const sugestao = incrementoMinimo !== null || estado.precoAtual === null
    ? proximoLance(estado, incrementoMinimo ?? 0, precoInicial)
    : 0
  const valor = editado?.versao === estado.versao ? editado.texto : sugestao > 0 ? paraCampo(sugestao) : ''

  const regra = podeDarLance(estado, agora)
  const fimMs = Date.parse(estado.fimEm)
  const cancelavel = estado.status === 'CRIADO' || estado.status === 'ABERTO'

  async function darLance(e: FormEvent) {
    e.preventDefault()
    const centavos = paraCentavos(valor)
    if (centavos === null) { setAviso({ tipo: 'erro', texto: 'Informe um valor maior que zero, por exemplo 150,00.' }); return }
    setEnviando(true)
    const r = await api.darLance(estado.leilaoId, { licitanteId: usuario, valor: centavos })
    setEnviando(false)
    if (r.tipo === 'aceito') setAviso({ tipo: 'ok', texto: `Lance de ${dinheiro(centavos)} aceito.` })
    else if (r.tipo === 'recusado') setAviso({ tipo: 'erro', texto: traduzirMensagem(r.codigo, r.mensagem) })
    else if (r.tipo === 'conflito') setAviso({ tipo: 'erro', texto: 'Muitos lances ao mesmo tempo. Tente de novo.' })
    else setAviso({ tipo: 'erro', texto: r.status === 0 ? 'Não foi possível falar com o servidor.' : `Erro inesperado (${r.status}).` })
  }

  async function cancelar() {
    setConfirmando(false)
    setEnviando(true)
    try {
      await api.cancelarLeilao(estado.leilaoId, 'Cancelado pelo vendedor')
      setAviso({ tipo: 'ok', texto: 'Leilão cancelado.' })
    } catch (err) {
      const texto = err instanceof ErroHttp && err.codigo === 'LEILAO_COM_LANCES'
        ? 'Não dá para cancelar: o leilão já tem lances.'
        : err instanceof Error && err.name !== 'TypeError' ? err.message : 'Não foi possível falar com o servidor.'
      setAviso({ tipo: 'erro', texto })
    }
    setEnviando(false)
  }

  return (
    <>
      <h2 className="palco-titulo">{estado.titulo}</h2>
      <p className="palco-status">
        <span className={`status status-${estado.status.toLowerCase()}`}>{ROTULO_STATUS[estado.status]}</span>
        {desatualizado && <span className="palco-aviso" role="status">desatualizado · reconectando…</span>}
      </p>

      {/* a chave faz o elemento remontar a cada novo preço e a animação CSS pulsa de novo */}
      <p className={`palco-preco${estado.precoAtual !== precoNaEntrada ? ' palco-preco--pulso' : ''}`} key={estado.precoAtual ?? 'sem-lance'}>{dinheiro(estado.precoAtual ?? precoInicial)}</p>
      <p className="palco-meta">
        {estado.liderId ?? 'sem lances'} · v{estado.versao}
      </p>
      {estado.status === 'ABERTO' && (
        <p className={`palco-contagem${fimMs - agora < 30_000 ? ' palco-contagem--urgente' : ''}`}>
          {fimMs > agora ? `faltam ${tempoRestante(fimMs - agora)}` : 'encerrando…'}
        </p>
      )}

      {!vendedor && (
        <form className="palco-lance" onSubmit={darLance}>
          <label htmlFor="valor-lance">Seu lance (R$) como {usuario}</label>
          <input id="valor-lance" inputMode="decimal" value={valor}
            onChange={(e) => setEditado({ versao: estado.versao, texto: e.target.value })}
            disabled={enviando || !regra.pode} />
          <button className="botao botao--destaque" type="submit" disabled={enviando || !regra.pode}>Dar lance</button>
          {!regra.pode && <span className="suave">{regra.motivo}</span>}
        </form>
      )}
      {vendedor && <p className="suave">Você está como vendedor: troque o usuário para dar lance.</p>}
      {vendedor && cancelavel && (
        <button className="botao" onClick={() => setConfirmando(true)} disabled={enviando}>Cancelar leilão</button>
      )}
      <Confirmar
        aberto={confirmando}
        titulo="Cancelar este leilão?"
        texto="O leilão será encerrado sem vencedor. Isso não pode ser desfeito."
        rotuloConfirmar="Cancelar leilão"
        perigo
        aoConfirmar={cancelar}
        aoCancelar={() => setConfirmando(false)}
      />
      {aviso && <p className={aviso.tipo === 'erro' ? 'erro' : 'ok'} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>{aviso.texto}</p>}
    </>
  )
}
