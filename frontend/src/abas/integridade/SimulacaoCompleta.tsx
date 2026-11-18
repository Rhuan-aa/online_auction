// Simulação completa da aba Integridade: cria o próprio leilão, mostra raias, contadores e checagens.
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../../api.ts'
import Raias from '../../graficos/Raias.tsx'
import { hrefDe } from '../../rota.ts'
import { ErroSimulacao, executar, type Execucao, type Progresso } from '../../simulacao.ts'
import FormSimulacao, { PADRAO, validar, type Campos } from './FormSimulacao.tsx'

const CHECAGENS: { chave: 'umVencedor' | 'trilhaCompleta' | 'ordem' | 'versoesContiguas'; rotulo: string }[] = [
  { chave: 'umVencedor', rotulo: 'vencedor = último lance aceito' },
  { chave: 'trilhaCompleta', rotulo: 'nenhum lance aceito sumiu' },
  { chave: 'ordem', rotulo: 'histórico em ordem' },
  { chave: 'versoesContiguas', rotulo: 'versões contíguas (1..n)' },
]

export default function SimulacaoCompleta() {
  const [campos, setCampos] = useState<Campos>(PADRAO)
  const [rodando, setRodando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [execucao, setExecucao] = useState<Execucao | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const controle = useRef<AbortController | null>(null)
  const focado = useRef<string | null>(null)

  useEffect(() => () => controle.current?.abort(), [])

  function aoProgredir(p: Progresso) {
    setProgresso(p)
    if (p.leilaoId && focado.current !== p.leilaoId) { // o leilão criado vira o foco do palco
      focado.current = p.leilaoId
      window.location.hash = hrefDe({ aba: 'integridade', leilaoId: p.leilaoId })
    }
  }

  async function iniciar(e: FormEvent) {
    e.preventDefault()
    const p = validar(campos)
    if (typeof p === 'string') return setErro(p)
    setErro(null)
    setExecucao(null)
    focado.current = null
    setRodando(true)
    const ctrl = new AbortController()
    controle.current = ctrl
    try {
      setExecucao(await executar(api, p, aoProgredir, ctrl.signal))
    } catch (err) {
      if (ctrl.signal.aborted && !(err instanceof ErroSimulacao)) return
      setErro(err instanceof Error && err.name !== 'TypeError' ? err.message : 'Não foi possível falar com o servidor.')
    } finally {
      controle.current = null
      setRodando(false)
      setProgresso(null)
    }
  }

  const raias = execucao
    ? [...new Set(execucao.lances.map((l) => l.licitanteId))].sort().map((nome) => ({
      nome, marcas: execucao.lances.filter((l) => l.licitanteId === nome).map((l) => ({ t: l.t, resultado: l.resultado })),
    }))
    : []
  const duracao = execucao ? Math.max(0, ...execucao.lances.map((l) => l.t)) : 0

  return (
    <section className="bloco-aba">
      <h2>Simulação completa</h2>
      <p className="suave">Cria um leilão novo, dispara os lances com N simultâneos e confere o resultado no fim.</p>
      <form className="simulacao" onSubmit={iniciar}>
        <FormSimulacao valor={campos} onChange={setCampos} desabilitado={rodando} />
        <div className="simulacao-botoes">
          {rodando
            ? <button type="button" className="perigo" onClick={() => controle.current?.abort()}>■ Parar</button>
            : <button type="submit">▶ Executar simulação</button>}
        </div>
      </form>
      {progresso && (
        <p className="resultado" role="status">
          {progresso.fase}… {progresso.enviados}/{progresso.total} enviados · {progresso.aceitos} aceitos ·{' '}
          {progresso.recusados} recusados · {progresso.conflitos} conflitos
        </p>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}
      {execucao && (
        <>
          <div className="kpis">
            <div className="kpi"><strong>{execucao.integridade.aceitos}</strong><span>aceitos</span></div>
            <div className="kpi"><strong>{execucao.integridade.recusados}</strong><span>recusados</span></div>
            <div className="kpi"><strong>{execucao.integridade.conflitos}</strong><span>conflitos</span></div>
            <div className="kpi"><strong>{execucao.integridade.colisoes}</strong><span>colisões (tentativas extras)</span></div>
          </div>
          <ul className="checagens-grandes">
            {CHECAGENS.map((c) => {
              const ok = execucao.integridade.checagens[c.chave]
              return <li key={c.chave} className={ok ? 'passou' : 'falhou'}><span aria-hidden="true">{ok ? '✓' : '✗'}</span> {c.rotulo}</li>
            })}
          </ul>
          {execucao.integridade.checagens.problemas.length > 0 && (
            <ul className="problemas">{execucao.integridade.checagens.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
          )}
          <Raias titulo="Lances por licitante" raias={raias} duracaoMs={duracao} />
        </>
      )}
    </section>
  )
}
