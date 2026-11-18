import { useEffect, useState } from 'react'
import { api, ErroHttp, type ResumoLeilao } from '../api.ts'
import { dinheiro, ROTULO_STATUS } from '../formato.ts'
import { escolherLeilao } from '../rota.ts'
import { VENDEDOR } from './regras.ts'
import type { Leilao } from './useLeilao.ts'

const DUAS_HORAS = 2 * 60 * 60 * 1000

const SITUACAO: Partial<Record<Leilao['situacao'], string>> = {
  carregando: 'Carregando o leilão…',
  'nao-encontrado': 'Leilão não encontrado: escolha outro ou crie um de demonstração.',
  indisponivel: 'Serviço de leitura (8082) fora do ar.',
  desatualizado: 'Conexão ao vivo caiu; mostrando o último estado recebido.',
}

const mensagem = (e: unknown, servico: string) =>
  e instanceof ErroHttp ? e.message : `Serviço de ${servico} fora do ar.`

/** Escolhe o leilão real (8081/8082) usado nas seções "caminho" e "tempo"; o id vai para ?leilao= no hash. */
export default function SeletorLeilao({ leilaoId, leilao }: { leilaoId: string | null; leilao: Leilao }) {
  const [abertos, setAbertos] = useState<ResumoLeilao[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let vigente = true
    api.listarLeiloes('ABERTO')
      .then((lista) => {
        if (!vigente) return
        setAbertos(lista)
        setErro(null)
        if (!leilaoId && lista.length > 0) escolherLeilao(lista[0].leilaoId)
      })
      .catch((e: unknown) => { if (vigente) setErro(mensagem(e, 'leitura (8082)')) })
    return () => { vigente = false }
  }, [recarga, leilaoId])

  async function criar() {
    setCriando(true)
    setErro(null)
    try {
      const agora = Date.now()
      const { leilaoId: novo } = await api.criarLeilao({
        vendedorId: VENDEDOR, titulo: 'Leilão de demonstração', precoInicial: 10000, incrementoMinimo: 100,
        inicioEm: new Date(agora).toISOString(), fimEm: new Date(agora + DUAS_HORAS).toISOString(),
      })
      escolherLeilao(novo)
      setRecarga((r) => r + 1)
    } catch (e) {
      setErro(mensagem(e, 'escrita (8081)'))
    } finally {
      setCriando(false)
    }
  }

  const e = leilao.estado
  const lista = abertos ?? []
  const foraDaLista = leilaoId !== null && !lista.some((l) => l.leilaoId === leilaoId)
  const situacao = SITUACAO[leilao.situacao]

  return (
    <div className="painel seletor-leilao">
      <div className="seletor-controles">
        <label className="seletor-campo">
          Leilão aberto
          <select value={leilaoId ?? ''} onChange={(ev) => escolherLeilao(ev.target.value || null)}>
            {!leilaoId && <option value="">{abertos === null ? 'carregando…' : 'nenhum leilão escolhido'}</option>}
            {foraDaLista && <option value={leilaoId}>{e ? e.titulo : leilaoId.slice(0, 8)} (escolhido)</option>}
            {lista.map((l) => (
              <option key={l.leilaoId} value={l.leilaoId}>{l.titulo} · {dinheiro(l.precoAtual)} · {l.leilaoId.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        <button type="button" className="botao" onClick={() => setRecarga((r) => r + 1)}>Atualizar lista</button>
        <button type="button" className="botao botao--destaque" onClick={() => void criar()} disabled={criando}>
          {criando ? 'Criando…' : 'Criar leilão de demonstração'}
        </button>
      </div>
      <p className="seletor-estado" aria-live="polite">
        {e && <><strong>{e.titulo}</strong> · {ROTULO_STATUS[e.status]} · {dinheiro(e.precoAtual)} · <span className="id">v{e.versao}</span> </>}
        {situacao && <span className="aviso">{situacao}</span>}
        {abertos !== null && lista.length === 0 && !leilaoId && <span className="suave">Nenhum leilão aberto: crie um de demonstração.</span>}
      </p>
      {erro && <p className="alerta" role="alert">{erro}</p>}
    </div>
  )
}
