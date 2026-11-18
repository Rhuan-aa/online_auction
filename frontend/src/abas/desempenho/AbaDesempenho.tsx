import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { api, type ConfiguracaoCache, type Servico } from '../../api.ts'
import { dataHora } from '../../formato.ts'
import { carregarComparacoes, rotuloSimulacao, salvarComparacoes } from '../../historico.ts'
import Aba from '../../shell/Aba.tsx'
import FormSimulacao, { PADRAO, validar, type Campos } from '../integridade/FormSimulacao.tsx'
import AoVivo from './AoVivo.tsx'
import { compararABC, type AndamentoComparacao, type Comparacao } from './comparacao.ts'
import ComparacaoAoVivo from './ComparacaoAoVivo.tsx'
import type { Progresso } from '../../simulacao.ts'
import GraficosComparacao from './GraficosComparacao.tsx'

type Ativa = Record<Servico, ConfiguracaoCache>

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

export default function AbaDesempenho({ pergunta }: { pergunta: string }) {
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
    <Aba pergunta={pergunta} adr="ADR-003" porQue={PORQUE}>
      <section className="bloco-aba">
        <h2>Configuração ativa</h2>
        {ativa && <p className="config-grande">Escrita: {ativa.escrita} · Leitura: {ativa.leitura}</p>}
        {divergem && <p className="aviso" role="alert">Escrita e leitura com configurações diferentes</p>}
        {erroAtiva && <p className="erro" role="alert">{erroAtiva}</p>}
      </section>

      <section className="bloco-aba">
        <h2>Comparar</h2>
        <p className="suave">Roda a mesma simulação em A, depois B, depois C, sem reiniciar nada, e devolve a configuração anterior.</p>
        <form className="simulacao" onSubmit={comparar}>
          <FormSimulacao valor={campos} onChange={setCampos} desabilitado={rodando} />
          <div className="simulacao-botoes">
            {!rodando && <button type="submit" className="botao botao--destaque">▶ Comparar A × B × C</button>}
          </div>
        </form>
        {rodando && <ComparacaoAoVivo andamento={andamento} finais={finais} aoInterromper={() => controle.current?.abort()} />}
        {erro && <p className="erro" role="alert">{erro}</p>}
        {aviso && <p className="aviso" role="alert">{aviso}</p>}
      </section>

      {!rodando && selecionada && (
        <section className="bloco-aba">
          <h2>Resultado: {rotuloSimulacao(selecionada.parametros)}</h2>
          <p className="suave">{dataHora(selecionada.quando)}{!selecionada.completa && ' · incompleta'}</p>
          <GraficosComparacao comparacao={selecionada} />
        </section>
      )}

      <section className="bloco-aba">
        <h2>Histórico de comparações</h2>
        {historico.length === 0
          ? <p className="suave">Nenhuma comparação ainda neste navegador.</p>
          : (
            <ul className="historico-comparacoes">
              {historico.map((c) => (
                <li key={c.id}>
                  <button type="button" aria-pressed={c.id === selecionadaId} disabled={rodando} onClick={() => setSelecionadaId(c.id)}>
                    {dataHora(c.quando)} · {rotuloSimulacao(c.parametros)}{!c.completa && ' (incompleta)'}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <AoVivo configuracao={ativa && !divergem ? ativa : null} pausado={rodando} />
    </Aba>
  )
}
