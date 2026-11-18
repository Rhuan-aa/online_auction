import { useEffect, useId, useRef, useState } from 'react'
import { dinheiro, ROTULO_STATUS, tempoRestante } from '../formato.ts'
import type { UsuarioId } from '../usuarios.ts'
import Palco from './Palco.tsx'
import type { Palco as DadosPalco } from './usePalco.ts'

interface Props {
  leilaoId: string | null
  palco: DadosPalco
  agora: number
  usuario: UsuarioId
  /** Painel aberto? Fica no App, que desliga as teclas de slide enquanto ele está aberto. */
  aberto: boolean
  aoMudarAberto: (aberto: boolean) => void
  aoAbrirLeiloes: () => void
  aoAbrirNovo: () => void
}

/**
 * Leilão em foco num cartão compacto (preço, líder · versão, contagem). Clicar abre o painel com o
 * palco completo (lance, cancelar, eventos, trocar/novo leilão). O painel fica montado quando fechado,
 * então o valor digitado e o último aviso continuam lá ao reabrir. Ao abrir, o foco vai para o painel;
 * ao fechar (✕ ou Esc), volta para o cartão.
 */
export default function CartaoAoVivo({ leilaoId, palco, agora, usuario, aberto, aoMudarAberto, aoAbrirLeiloes, aoAbrirNovo }: Props) {
  const idPainel = useId()
  const painel = useRef<HTMLElement>(null)
  const gatilho = useRef<HTMLButtonElement>(null)

  useEffect(() => { if (aberto) painel.current?.focus() }, [aberto])

  useEffect(() => {
    if (!aberto) return
    // o Esc da janela "Cancelar este leilão?" fecha só a janela, não o painel
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || (e.target instanceof Element && e.target.closest('dialog'))) return
      aoMudarAberto(false)
      gatilho.current?.focus()
    }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [aberto, aoMudarAberto])

  const fechar = () => { aoMudarAberto(false); gatilho.current?.focus() }
  // abrir uma gaveta fecha o painel, para a gaveta não abrir por baixo dele
  const abrirLeiloes = () => { aoMudarAberto(false); aoAbrirLeiloes() }
  const abrirNovo = () => { aoMudarAberto(false); aoAbrirNovo() }

  return (
    <div className="vivo">
      <button ref={gatilho} type="button" className="cartao-vivo" aria-expanded={aberto} aria-controls={idPainel}
        title={aberto ? 'Fechar o painel do leilão' : 'Abrir o painel do leilão'}
        onClick={() => (palco.situacao === 'sem-leilao' ? abrirLeiloes() : aoMudarAberto(!aberto))}>
        <Resumo palco={palco} agora={agora} />
      </button>
      {/* depois do cartão no DOM: o Tab segue do cartão para dentro do painel */}
      <section ref={painel} id={idPainel} className="painel-vivo" aria-label="Leilão em foco" hidden={!aberto} tabIndex={-1}>
        <button type="button" className="painel-vivo-fechar" onClick={fechar} aria-label="Fechar painel">✕</button>
        <Palco leilaoId={leilaoId} palco={palco} agora={agora} usuario={usuario}
          aoAbrirLeiloes={abrirLeiloes} aoAbrirNovo={abrirNovo} />
      </section>
    </div>
  )
}

function Resumo({ palco, agora }: { palco: DadosPalco; agora: number }) {
  const { estado, situacao, precoInicial } = palco
  const preco = estado ? estado.precoAtual ?? precoInicial : null
  // o preço pulsa quando muda no mesmo leilão (não ao trocar de leilão nem na primeira exibição)
  const [visto, setVisto] = useState({ id: estado?.leilaoId ?? null, preco })
  if (visto.id !== (estado?.leilaoId ?? null)) setVisto({ id: estado?.leilaoId ?? null, preco })
  const pulsa = visto.id === (estado?.leilaoId ?? null) && preco !== visto.preco

  if (situacao === 'sem-leilao') return <Mensagem texto="Escolha um leilão" detalhe="nenhum leilão em foco" />
  if (situacao === 'nao-encontrado') return <Mensagem texto="leilão não encontrado" detalhe="clique para escolher outro" perigo />
  if (!estado) {
    return situacao === 'indisponivel'
      ? <Mensagem texto="indisponível — tentando de novo" detalhe="sem resposta do servidor" perigo />
      : <Mensagem texto="carregando…" />
  }

  const fimMs = Date.parse(estado.fimEm)
  const aberto = estado.status === 'ABERTO'
  const rotulo = situacao === 'desatualizado' ? 'desatualizado' : aberto ? 'ao vivo' : ROTULO_STATUS[estado.status].toLowerCase()
  const classe = situacao === 'desatualizado' ? ' cartao-vivo-rotulo--aviso' : aberto ? '' : ' cartao-vivo-rotulo--parado'
  return (
    <>
      <span className={`cartao-vivo-rotulo${classe}`}>{rotulo}</span>
      <span className={`cartao-vivo-preco${pulsa ? ' palco-preco--pulso' : ''}`} key={preco ?? 'sem-lance'}>{dinheiro(preco)}</span>
      <span className="cartao-vivo-meta">
        {estado.liderId ?? 'sem lances'} · v{estado.versao}
        {aberto && <> · <span className={fimMs - agora < 30_000 ? 'urgente' : undefined}>{fimMs > agora ? tempoRestante(fimMs - agora) : 'encerrando…'}</span></>}
      </span>
    </>
  )
}

function Mensagem({ texto, detalhe, perigo }: { texto: string; detalhe?: string; perigo?: boolean }) {
  return (
    <>
      <span className={`cartao-vivo-rotulo ${perigo ? 'cartao-vivo-rotulo--perigo' : 'cartao-vivo-rotulo--parado'}`}>leilão</span>
      <span className="cartao-vivo-detalhe">{detalhe}</span>
      <span className="cartao-vivo-mensagem">{texto}</span>
    </>
  )
}
