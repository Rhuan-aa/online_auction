// Painel de ADM (docs/PAINEL_ADM.md): configura e executa uma simulação, mostra integridade e
// desempenho na configuração ativa (A/B/C) e guarda as execuções para comparar lado a lado.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { api, type Servico } from './api.ts'
import { dataHora, dinheiro, paraCentavos } from './formato.ts'
import Grafico, { type Serie } from './Grafico.tsx'
import { carregarHistorico, chaveSimulacao, MAXIMO_HISTORICO, rotuloSimulacao, salvarHistorico } from './historico.ts'
import { hrefDe } from './rota.ts'
import { type Base, BASES, lerConfiguracao, type ResumoBackend } from './metricas.ts'
import { ErroSimulacao, executar, type Execucao, type Parametros, type Progresso } from './simulacao.ts'

const CONFIGURACOES = ['A', 'B', 'C'] as const
type Configuracao = typeof CONFIGURACOES[number]
const DESCRICAO: Record<string, string> = {
  A: 'sem cache',
  B: 'só checkpoint',
  C: 'Redis + checkpoint',
}
/** Como cada configuração monta o estado do leilão (ADR-003). */
const COMO: Record<Configuracao, string> = {
  A: 'Sem cache: relê todos os eventos do leilão no banco a cada pedido.',
  B: 'Só checkpoint: parte da cópia no Postgres (gravada a cada 50 eventos) e lê os eventos depois dela.',
  C: 'Redis + checkpoint: parte da cópia no Redis e lê só o que falta (quase sempre nada).',
}
const MAX_CONEXOES = 6

interface Campos {
  licitantes: string; lancesPorLicitante: string; simultaneos: string
  precoInicial: string; incrementoMin: string; incrementoMax: string
  leitores: string; semente: string
  acompanharPreco: boolean
}

const PADRAO: Campos = {
  licitantes: '20', lancesPorLicitante: '10', simultaneos: '6',
  precoInicial: '100,00', incrementoMin: '1,00', incrementoMax: '50,00',
  leitores: '4', semente: '42', acompanharPreco: true,
}

/** Campos → parâmetros; devolve a mensagem de erro se algum for inválido. */
function validar(c: Campos): Parametros | string {
  const inteiro = (texto: string, nome: string, min: number, max: number): number | string => {
    const n = Number(texto)
    return Number.isInteger(n) && n >= min && n <= max ? n : `${nome}: informe um inteiro de ${min} a ${max}.`
  }
  const licitantes = inteiro(c.licitantes, 'Licitantes', 1, 200)
  const lances = inteiro(c.lancesPorLicitante, 'Lances por licitante', 1, 500)
  const simultaneos = inteiro(c.simultaneos, 'Lances simultâneos', 1, MAX_CONEXOES)
  const leitores = inteiro(c.leitores, 'Leitores', 1, MAX_CONEXOES)
  const semente = inteiro(c.semente, 'Semente', 0, 2 ** 31 - 1)
  for (const v of [licitantes, lances, simultaneos, leitores, semente]) if (typeof v === 'string') return v
  const preco = paraCentavos(c.precoInicial)
  const incMin = paraCentavos(c.incrementoMin)
  const incMax = paraCentavos(c.incrementoMax)
  if (preco === null) return 'Informe um preço inicial maior que zero.'
  if (incMin === null || incMax === null) return 'Informe a faixa de incremento com valores maiores que zero.'
  if (incMax < incMin) return 'O fim da faixa de incremento precisa ser maior ou igual ao início.'
  return {
    licitantes: licitantes as number, lancesPorLicitante: lances as number, simultaneos: simultaneos as number,
    precoInicial: preco, incrementoMin: incMin, incrementoMax: incMax,
    leitores: leitores as number, semente: semente as number, acompanharPreco: c.acompanharPreco,
  }
}

const ms = (v: number | null | undefined) => (v == null ? '—' : `${v.toFixed(1)} ms`)
const num = (v: number | null | undefined, casas = 1) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: casas })
const pct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(0)}%`)

const ORIGEM: Record<Base, string> = {
  redis: 'cópia no Redis',
  checkpoint: 'checkpoint',
  inicio: 'do zero, relendo todos os eventos',
  fonte: 'da fonte (encerramento)',
}

/** De onde o backend partiu para montar o estado: a prova de que, sem cache, ele relê o Event Store. */
function Origem({ backend }: { backend: ResumoBackend }) {
  const usadas = BASES.filter((b) => backend.porBase[b] > 0)
  return (
    <div>
      <dt>De onde veio o estado</dt>
      <dd className="origem">
        {usadas.length === 0 ? '—' : usadas.map((b) => (
          <span key={b}>{num(backend.porBase[b], 0)}× {ORIGEM[b]}</span>
        ))}
      </dd>
    </div>
  )
}

/** "100% do zero, relendo todos os eventos": a origem mais usada para montar o estado. */
function origemPrincipal(b: ResumoBackend): string {
  const total = BASES.reduce((s, x) => s + b.porBase[x], 0)
  if (total === 0) return '—'
  const maior = BASES.reduce((m, x) => (b.porBase[x] > b.porBase[m] ? x : m))
  return `${pct(b.porBase[maior] / total)} ${ORIGEM[maior]}`
}

const LINHAS: { rotulo: string; destaque?: boolean; valor: (e: Execucao) => ReactNode }[] = [
  { rotulo: 'Eventos relidos do banco por lance', destaque: true, valor: (e) => num(e.escrita.backend.eventosPorObtencao) },
  { rotulo: 'Eventos relidos do banco por consulta', destaque: true, valor: (e) => num(e.leitura.backend.eventosPorObtencao) },
  { rotulo: 'De onde o servidor partiu (lances)', valor: (e) => origemPrincipal(e.escrita.backend) },
  { rotulo: 'Tempo do lance (mediana)', valor: (e) => ms(e.escrita.p50) },
  { rotulo: 'Tempo da consulta (mediana)', valor: (e) => ms(e.leitura.p50) },
]

/** A tabela que responde "o que o cache muda": uma coluna por configuração, mesma simulação. */
function Comparacao({ porConfig }: { porConfig: Partial<Record<Configuracao, Execucao>> }) {
  return (
    <>
      <div className="tabela">
        <table className="lances comparacao">
          <thead>
            <tr>
              <th />
              {CONFIGURACOES.map((cfg) => (
                <th key={cfg}>
                  <span className={`serie-${cfg.toLowerCase()} etiqueta`}><i aria-hidden="true" />{cfg}</span>
                  <span className="como">{COMO[cfg]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS.map((l) => (
              <tr key={l.rotulo} className={l.destaque ? 'destaque' : undefined}>
                <th scope="row">{l.rotulo}</th>
                {CONFIGURACOES.map((cfg) => {
                  const e = porConfig[cfg]
                  return <td key={cfg} className="num">{e ? l.valor(e) : <span className="suave">não rodou</span>}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="suave nota">
        Comece pelas linhas destacadas. Sem cache (A), o servidor remonta o estado relendo o histórico do leilão no
        Event Store, e esse número cresce com o tamanho do leilão. Com o Redis (C), ele parte da cópia e lê quase nada.
        O resultado é o mesmo nas três: o cache só economiza trabalho, a fonte da verdade continua sendo o Event Store.
        Para comparar, rode a mesma simulação em cada configuração (reinicie escrita e leitura com CACHE_CONFIGURACAO).
      </p>
    </>
  )
}

function Marca({ ok, rotulo }: { ok: boolean; rotulo: string }) {
  return <span className={`checagem ${ok ? 'passou' : 'falhou'}`}>{ok ? '✓' : '✗'} {rotulo}</span>
}

export default function PainelAdm() {
  const [campos, setCampos] = useState<Campos>(PADRAO)
  const [config, setConfig] = useState<Record<Servico, string | null> | null>(null)
  const [rodando, setRodando] = useState(false)
  const [progresso, setProgresso] = useState<Progresso | null>(null)
  const [erro, setErro] = useState<{ mensagem: string; leilaoId?: string } | null>(null)
  const [historico, setHistorico] = useState<Execucao[]>(carregarHistorico)
  const [selecionada, setSelecionada] = useState<string | null>(() => historico[0]?.id ?? null)
  const [visao, setVisao] = useState<Servico>('escrita')
  const controle = useRef<AbortController | null>(null)

  // Relida ao abrir, após cada execução e no botão: o ADM pode ter reiniciado com outra configuração.
  const atualizarConfig = useCallback(() => { lerConfiguracao(api).then(setConfig) }, [])
  useEffect(atualizarConfig, [atualizarConfig])
  useEffect(() => () => controle.current?.abort(), []) // sair da tela interrompe a simulação

  const mudar = (campo: Exclude<keyof Campos, 'acompanharPreco'>) => (e: { target: { value: string } }) =>
    setCampos((c) => ({ ...c, [campo]: e.target.value }))

  const configOk = config?.escrita != null && config.escrita === config.leitura
  const avisoConfig = !config ? null
    : !config.escrita || !config.leitura
      ? `Sem resposta de /actuator/metrics na ${!config.escrita ? 'escrita (8081)' : 'leitura (8082)'}. O serviço está no ar?`
      : config.escrita !== config.leitura
        ? `A escrita está em ${config.escrita} e a leitura em ${config.leitura}. Reinicie as duas com o mesmo CACHE_CONFIGURACAO.`
        : null

  async function iniciar(e: FormEvent) {
    e.preventDefault()
    const p = validar(campos)
    if (typeof p === 'string') return setErro({ mensagem: p })
    setErro(null)
    setRodando(true)
    const ctrl = new AbortController()
    controle.current = ctrl
    try {
      const execucao = await executar(api, p, setProgresso, ctrl.signal)
      setHistorico((h) => {
        const nova = [execucao, ...h].slice(0, MAXIMO_HISTORICO)
        salvarHistorico(nova)
        return nova
      })
      setSelecionada(execucao.id)
    } catch (err) {
      if (ctrl.signal.aborted && !(err instanceof ErroSimulacao)) return // saiu da tela
      setErro({
        mensagem: err instanceof Error && err.name !== 'TypeError' ? err.message : 'Não foi possível falar com o servidor.',
        leilaoId: err instanceof ErroSimulacao ? err.leilaoId : undefined,
      })
    } finally {
      controle.current = null
      setRodando(false)
      setProgresso(null)
      atualizarConfig()
    }
  }

  function remover(id: string) {
    setHistorico((h) => {
      const nova = h.filter((x) => x.id !== id)
      salvarHistorico(nova)
      return nova
    })
    if (selecionada === id) setSelecionada(null)
  }

  function limpar() {
    if (!window.confirm('Apagar todas as execuções guardadas neste navegador?')) return
    setHistorico([])
    salvarHistorico([])
    setSelecionada(null)
  }

  const atual = historico.find((x) => x.id === selecionada) ?? null
  const chaveAtual = atual ? chaveSimulacao(atual.parametros) : null
  // Comparação e gráfico: a execução mais recente de cada configuração com a mesma simulação da selecionada.
  const porConfig: Partial<Record<Configuracao, Execucao>> = {}
  if (atual) {
    for (const cfg of CONFIGURACOES) {
      const e = cfg === atual.configuracao ? atual
        : historico.find((x) => x.configuracao === cfg && chaveSimulacao(x.parametros) === chaveAtual)
      if (e) porConfig[cfg] = e
    }
  }
  const series: Serie[] = CONFIGURACOES.flatMap((cfg) => {
    const e = porConfig[cfg]
    return e ? [{ nome: cfg, classe: `serie-${cfg.toLowerCase()}`, pontos: e.grafico[visao] }] : []
  })

  return (
    <section className="painel">
      <div className="cabecalho">
        <h1>Painel de ADM</h1>
        <span className="config-ativa" role="status">
          {!config ? 'Lendo a configuração…'
            : configOk ? <>Configuração ativa: <strong>{config.escrita}</strong> <span className="suave">({DESCRICAO[config.escrita!] ?? '?'})</span></>
            : 'Configuração indefinida'}
          <button type="button" onClick={() => { setConfig(null); atualizarConfig() }} disabled={rodando}>Atualizar</button>
        </span>
      </div>
      {avisoConfig && <p className="erro" role="alert">{avisoConfig}</p>}

      <h2>Simulação</h2>
      <form className="simulacao" onSubmit={iniciar}>
        <fieldset disabled={rodando}>
          <label>Licitantes<input inputMode="numeric" value={campos.licitantes} onChange={mudar('licitantes')} /></label>
          <label>Lances por licitante<input inputMode="numeric" value={campos.lancesPorLicitante} onChange={mudar('lancesPorLicitante')} /></label>
          <label>Lances simultâneos (1–{MAX_CONEXOES})<input inputMode="numeric" value={campos.simultaneos} onChange={mudar('simultaneos')} /></label>
          <label>Leitores (1–{MAX_CONEXOES})<input inputMode="numeric" value={campos.leitores} onChange={mudar('leitores')} /></label>
          <label>Preço inicial (R$)<input inputMode="decimal" value={campos.precoInicial} onChange={mudar('precoInicial')} /></label>
          <label>Incremento de (R$)<input inputMode="decimal" value={campos.incrementoMin} onChange={mudar('incrementoMin')} /></label>
          <label>até (R$)<input inputMode="decimal" value={campos.incrementoMax} onChange={mudar('incrementoMax')} /></label>
          <label>Semente<input inputMode="numeric" value={campos.semente} onChange={mudar('semente')} /></label>
          <label className="opcao" title="Envia o maior entre o valor planejado e o último preço conhecido + incremento mínimo. Desligado, quase todo lance é recusado e o leilão fica curto.">
            <input type="checkbox" checked={campos.acompanharPreco}
              onChange={(e) => setCampos((c) => ({ ...c, acompanharPreco: e.target.checked }))} />
            Lance acompanha o preço (leilão longo)
          </label>
        </fieldset>
        <div className="simulacao-botoes">
          {rodando
            ? <button type="button" className="perigo" onClick={() => controle.current?.abort()}>■ Parar</button>
            : <button type="submit" disabled={!configOk}>▶ Executar</button>}
          <span className="suave nota">
            O navegador abre ~{MAX_CONEXOES} conexões por porta (somando as abas): acima disso os pedidos esperam na fila
            dele e o tempo medido inclui essa espera. Feche as abas de detalhe, que prendem uma conexão SSE na 8082.
            A semente fixa os valores e a ordem dos lances; aceitos e recusados dependem do tempo de resposta.
          </span>
        </div>
      </form>

      {progresso && (
        <p className="resultado" role="status">
          {progresso.fase}… {progresso.enviados}/{progresso.total} lances · {progresso.aceitos} aceitos ·{' '}
          {progresso.recusados} recusados · {progresso.conflitos} conflitos · {progresso.consultas} consultas
          {progresso.leilaoId && <> · <a href={hrefDe({ aba: 'integridade', leilaoId: progresso.leilaoId })}>leilão</a></>}
        </p>
      )}
      {erro && (
        <p className="erro" role="alert">
          {erro.mensagem}{erro.leilaoId && <> <a href={hrefDe({ aba: 'integridade', leilaoId: erro.leilaoId })}>Ver o leilão</a>.</>}
        </p>
      )}

      {atual && (
        <>
          <h2>Comparação A × B × C <span className="suave">· {rotuloSimulacao(atual.parametros)}</span></h2>
          <Comparacao porConfig={porConfig} />

          <div className="cabecalho grafico-topo">
            <h2>
              Detalhes da execução {atual.configuracao} <span className="suave">· {dataHora(atual.quando)} ·{' '}
              <a href={hrefDe({ aba: 'integridade', leilaoId: atual.leilaoId })}>ver o leilão</a></span>
            </h2>
            <div className="filtros" role="group" aria-label="Configuração exibida nos detalhes">
              {CONFIGURACOES.map((cfg) => {
                const e = porConfig[cfg]
                return (
                  <button key={cfg} type="button" aria-pressed={e?.id === atual.id} disabled={!e}
                    title={e ? undefined : 'Ainda não rodou nesta configuração'} onClick={() => e && setSelecionada(e.id)}>
                    {cfg}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="blocos">
            <div className="bloco">
              <h3>Resultado do leilão está correto?</h3>
              <p className="numeros">
                <span><strong>{atual.integridade.aceitos}</strong> lances aceitos</span>
                <span><strong>{atual.integridade.recusados}</strong> recusados (abaixo do mínimo)</span>
                <span><strong>{atual.integridade.conflitos}</strong> em conflito (409)</span>
                {atual.integridade.erros > 0 && <span><strong>{atual.integridade.erros}</strong> com erro</span>}
              </p>
              <p className="checagens">
                <Marca ok={atual.integridade.checagens.umVencedor} rotulo="vencedor = último lance aceito" />
                <Marca ok={atual.integridade.checagens.trilhaCompleta} rotulo="nenhum lance aceito sumiu" />
                <Marca ok={atual.integridade.checagens.ordem} rotulo="histórico em ordem" />
              </p>
              {atual.integridade.checagens.problemas.length > 0 && (
                <ul className="problemas">{atual.integridade.checagens.problemas.map((p) => <li key={p}>{p}</li>)}</ul>
              )}
            </div>

            <div className="bloco">
              <h3>Lances <span className="suave">· serviço de escrita (8081)</span></h3>
              <dl>
                <div><dt>Tempo de resposta (mediana / 95% dos pedidos)</dt><dd>{ms(atual.escrita.p50)} / {ms(atual.escrita.p95)}</dd></div>
                <div><dt>Lances por segundo</dt><dd>{num(atual.escrita.lancesPorSegundo)}</dd></div>
                <div><dt>Eventos relidos do banco por pedido</dt><dd>{num(atual.escrita.backend.eventosPorObtencao, 2)}</dd></div>
                <div><dt>Tempo para montar o estado (média no servidor)</dt><dd>{ms(atual.escrita.backend.tempoMedioMs)}</dd></div>
                <div><dt>Vezes que o estado foi montado</dt><dd>{num(atual.escrita.backend.obtencoes, 0)}</dd></div>
                <Origem backend={atual.escrita.backend} />
              </dl>
            </div>

            <div className="bloco">
              <h3>Consultas <span className="suave">· serviço de leitura (8082)</span></h3>
              <dl>
                <div><dt>Tempo de resposta (mediana / 95% dos pedidos)</dt><dd>{ms(atual.leitura.p50)} / {ms(atual.leitura.p95)}</dd></div>
                <div><dt>Consultas feitas</dt><dd>{num(atual.leitura.consultas, 0)}{atual.leitura.errosConsulta > 0 && ` (${atual.leitura.errosConsulta} com erro)`}</dd></div>
                <div><dt>Eventos relidos do banco por pedido</dt><dd>{num(atual.leitura.backend.eventosPorObtencao, 2)}</dd></div>
                <div><dt>Pedidos atendidos pela cópia no Redis</dt><dd>{pct(atual.leitura.backend.acertoCache)}</dd></div>
                <div><dt>Tempo para montar o estado (média no servidor)</dt><dd>{ms(atual.leitura.backend.tempoMedioMs)}</dd></div>
                <div><dt>Vezes que o estado foi montado</dt><dd>{num(atual.leitura.backend.obtencoes, 0)}</dd></div>
                <Origem backend={atual.leitura.backend} />
              </dl>
              <p className="suave nota">
                Inclui as vezes em que o ouvinte Kafka da leitura montou o estado (uma por evento), além das consultas.
              </p>
            </div>
          </div>

          <div className="cabecalho grafico-topo">
            <h2>Tempo de resposta conforme o leilão cresce</h2>
            <div className="filtros">
              {(['escrita', 'leitura'] as const).map((v) => (
                <button key={v} type="button" aria-pressed={visao === v} onClick={() => setVisao(v)}>
                  {v === 'escrita' ? 'Lances' : 'Consultas'}
                </button>
              ))}
            </div>
          </div>
          <Grafico
            series={series}
            titulo={`Tempo de resposta ${visao === 'escrita' ? 'dos lances' : 'das consultas'} (mediana, medido no navegador)`}
          />
          {series.length < CONFIGURACOES.length && (
            <p className="suave nota">
              Para comparar, rode a mesma simulação (mesmos parâmetros e semente) nas outras configurações:
              faltam {CONFIGURACOES.filter((c) => !series.some((s) => s.nome === c)).join(', ')}.
            </p>
          )}
        </>
      )}

      <div className="cabecalho grafico-topo">
        <h2>Histórico <span className="suave">({historico.length} de {MAXIMO_HISTORICO}, neste navegador)</span></h2>
        {historico.length > 0 && <button type="button" onClick={limpar} disabled={rodando}>Limpar histórico</button>}
      </div>
      {historico.length === 0
        ? <p className="vazio">Nenhuma execução ainda.</p>
        : (
          <div className="tabela">
            <table className="lances historico">
              <thead>
                <tr>
                  <th>Quando</th><th>Config.</th><th>Simulação</th><th>Aceitos</th><th>Correto?</th>
                  <th>Tempo do lance (mediana / 95%)</th><th>Tempo da consulta (mediana / 95%)</th>
                  <th>Eventos relidos por pedido (lance · consulta)</th><th>Consultas pela cópia no Redis</th><th />
                </tr>
              </thead>
              <tbody>
                {historico.map((x) => {
                  const c = x.integridade.checagens
                  const integro = c.umVencedor && c.trilhaCompleta && c.ordem
                  return (
                    <tr key={x.id} className={x.id === selecionada ? 'lider' : chaveSimulacao(x.parametros) === chaveAtual ? 'mesma' : undefined}>
                      <td>{dataHora(x.quando)}</td>
                      <td><span className={`serie-${x.configuracao.toLowerCase()} etiqueta`}><i aria-hidden="true" />{x.configuracao}</span></td>
                      <td title={`Preço ${dinheiro(x.parametros.precoInicial)}, incremento ${dinheiro(x.parametros.incrementoMin)} a ${dinheiro(x.parametros.incrementoMax)}`}>
                        {rotuloSimulacao(x.parametros)}
                      </td>
                      <td className="num">{x.integridade.aceitos}</td>
                      <td>{integro ? '✓ sim' : '✗ não'}</td>
                      <td className="num">{ms(x.escrita.p50)} / {ms(x.escrita.p95)}</td>
                      <td className="num">{ms(x.leitura.p50)} / {ms(x.leitura.p95)}</td>
                      <td className="num">{num(x.escrita.backend.eventosPorObtencao, 2)} · {num(x.leitura.backend.eventosPorObtencao, 2)}</td>
                      <td className="num">{pct(x.leitura.backend.acertoCache)}</td>
                      <td className="acoes-linha">
                        <button type="button" onClick={() => remover(x.id)} disabled={rodando}>Remover</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
    </section>
  )
}
