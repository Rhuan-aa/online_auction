import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, type ConfiguracaoCache } from '../../api.ts'
import { carregarComparacoes, salvarComparacoes } from '../../historico.ts'
import Passos from '../../shell/Passos.tsx'
import PorQue from '../../shell/PorQue.tsx'
import { PADRAO, validar, type Campos } from '../integridade/FormSimulacao.tsx'
import { compararABC, type AndamentoComparacao, type Comparacao } from './comparacao.ts'
import { PassoComparar, PassoPorDentro, PassoResultado, PassoTempoVersao, type Ativa } from './PassosComparacao.tsx'
import type { Progresso } from '../../simulacao.ts'

const PORQUE = (
  <p>
    A cópia do estado tem versão: fica incompleta, nunca errada. O serviço lê só os eventos posteriores à cópia
    (ADR-003). Por isso o cache pode ser trocado em tempo de execução sem risco para a correção, e a comparação
    mede só o custo.
  </p>
)

async function lerAtiva(): Promise<Ativa> {
  const [escrita, leitura] = await Promise.all([api.lerConfiguracaoCache('escrita'), api.lerConfiguracaoCache('leitura')])
  return { escrita, leitura }
}

export default function AbaDesempenho({ pergunta, passo }: { pergunta: string; passo: number }) {
  const [campos, setCampos] = useState<Campos>(PADRAO)
  const [ativa, setAtiva] = useState<Ativa | null>(null)
  const [erroAtiva, setErroAtiva] = useState<string | null>(null)
  const [rodando, setRodando] = useState(false)
  const [andamento, setAndamento] = useState<AndamentoComparacao | null>(null)
  const [finais, setFinais] = useState<Partial<Record<ConfiguracaoCache, Progresso>>>({}) // último progresso de cada coluna
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [historico, setHistorico] = useState<Comparacao[]>(carregarComparacoes)
  const [selecionadaId, setSelecionadaId] = useState<string | null>(() => carregarComparacoes()[0]?.id ?? null)
  const controle = useRef<AbortController | null>(null)

  const recarregarAtiva = useCallback(async () => {
    try {
      setAtiva(await lerAtiva())
      setErroAtiva(null)
    } catch {
      setAtiva(null)
      setErroAtiva('Não foi possível ler a configuração do cache.')
    }
  }, [])

  useEffect(() => {
    let vivo = true
    lerAtiva().then((a) => { if (vivo) { setAtiva(a); setErroAtiva(null) } }).catch(() => {
      if (vivo) { setAtiva(null); setErroAtiva('Não foi possível ler a configuração do cache.') }
    })
    return () => { vivo = false; controle.current?.abort() }
  }, [])

  async function comparar(e: FormEvent) {
    e.preventDefault()
    const p = validar(campos)
    if (typeof p === 'string') return setErro(p)
    setErro(null)
    setAviso(null)
    setAndamento(null)
    setFinais({})
    setRodando(true)
    const ctrl = new AbortController()
    controle.current = ctrl
    try {
      const c = await compararABC(api, p, (a) => {
        setAndamento(a)
        setFinais((f) => ({ ...f, [a.configuracao]: a.progresso }))
      }, ctrl.signal)
      if (c.restauracaoFalhou) setAviso('Não foi possível devolver os serviços à configuração anterior. Confira a configuração ativa.')
      if (Object.keys(c.execucoes).length > 0) {
        const novo = [c, ...historico]
        salvarComparacoes(novo)
        setHistorico(novo.slice(0, 10))
        setSelecionadaId(c.id)
      }
    } catch (err) {
      if (!ctrl.signal.aborted) setErro(err instanceof Error && err.name !== 'TypeError' ? err.message : 'Não foi possível falar com o servidor.')
    } finally {
      controle.current = null
      setRodando(false)
      setAndamento(null)
      void recarregarAtiva()
    }
  }

  const selecionada = historico.find((c) => c.id === selecionadaId) ?? null
  const divergem = ativa !== null && ativa.escrita !== ativa.leitura

  return (
    <Passos passo={passo}>
      <PassoComparar
        pergunta={pergunta} ativa={ativa} divergem={divergem} erroAtiva={erroAtiva}
        campos={campos} aoMudarCampos={setCampos} rodando={rodando} andamento={andamento} finais={finais}
        erro={erro} aviso={aviso} aoComparar={comparar} aoInterromper={() => controle.current?.abort()}
        temResultado={selecionada !== null}
      />
      <PassoResultado selecionada={selecionada} rodando={rodando} />
      <PassoPorDentro selecionada={selecionada} rodando={rodando} />
      <PassoTempoVersao
        selecionada={selecionada} rodando={rodando} historico={historico} selecionadaId={selecionadaId}
        aoSelecionar={setSelecionadaId} configuracao={ativa && !divergem ? ativa : null}
      />
      <PorQue adr="ADR-003">{PORQUE}</PorQue>
    </Passos>
  )
}
