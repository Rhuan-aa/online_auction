import { useEffect, useId, useState } from 'react'
import { dinheiro, ROTULO_STATUS, tempoRestante } from '../formato.ts'
import type { UsuarioId } from '../usuarios.ts'
import Palco from './Palco.tsx'
import type { Palco as DadosPalco } from './usePalco.ts'

interface Props {
  leilaoId: string | null
  palco: DadosPalco
  agora: number
  usuario: UsuarioId
  aoAbrirLeiloes: () => void
  aoAbrirNovo: () => void
}

/**
 * Leilão em foco num cartão compacto (preço, líder · versão, contagem). Clicar abre o painel com o
 * palco completo (lance, cancelar, eventos, trocar/novo leilão). O painel fica montado quando fechado,
 * então o valor digitado e o último aviso continuam lá ao reabrir.
 */
export default function CartaoAoVivo({ leilaoId, palco, agora, usuario, aoAbrirLeiloes, aoAbrirNovo }: Props) {
  const [aberto, setAberto] = useState(false)
  const idPainel = useId()

  useEffect(() => {
    if (!aberto) return
    const aoTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    window.addEventListener('keydown', aoTecla)
    return () => window.removeEventListener('keydown', aoTecla)
  }, [aberto])

  // abrir uma gaveta fecha o painel, para a gaveta não abrir por baixo dele
  const abrirLeiloes = () => { setAberto(false); aoAbrirLeiloes() }
  const abrirNovo = () => { setAberto(false); aoAbrirNovo() }

  return (
    <div className="vivo">
      <section id={idPainel} className="painel-vivo" aria-label="Leilão em foco" hidden={!aberto}>
        <button type="button" className="painel-vivo-fechar" onClick={() => setAberto(false)} aria-label="Fechar painel">✕</button>
        <Palco leilaoId={leilaoId} palco={palco} agora={agora} usuario={usuario}
          aoAbrirLeiloes={abrirLeiloes} aoAbrirNovo={abrirNovo} />
      </section>
      <button type="button" className="cartao-vivo" aria-expanded={aberto} aria-controls={idPainel}
        title={aberto ? 'Fechar o painel do leilão' : 'Abrir o painel do leilão'}
        onClick={() => (palco.situacao === 'sem-leilao' ? abrirLeiloes() : setAberto((a) => !a))}>
        <Resumo palco={palco} agora={agora} />
      </button>
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
      <span className={`cartao-vivo-rotulo ${perigo ? 'cartao-vivo-rotulo--perigo' : 'cartao-vivo-rotulo--parado'}`}>ao vivo</span>
      <span className="cartao-vivo-detalhe">{detalhe}</span>
      <span className="cartao-vivo-mensagem">{texto}</span>
    </>
  )
}
