import { useEffect, useState } from 'react'
import { ICONES } from './icones.tsx'

const TITULO = 'ADR-004 · Uso do Apache Kafka como broker de eventos'

/** Um evento de um leilão (A, B ou C), com a cor do leilão. */
function Ev({ id, estado = '' }: { id: string; estado?: string }) {
  return <i className={`kf-ev kf-ev--${id[0]} ${estado}`}>{id}</i>
}

/* ---------- tela A: contexto ---------- */

const PICO = ['A1', 'B1', 'A2', 'C1', 'B2', 'A3', 'A4', 'C2', 'B3', 'A5', 'C3', 'A6', 'B4', 'A7', 'C4'] as const

const REQUISITOS = [
  { icone: ICONES.raio, titulo: 'Os lances chegam em picos', detalhe: 'muitos ao mesmo tempo nos últimos segundos' },
  { icone: ICONES.fila, titulo: 'Cada leilão mantém a sua ordem', detalhe: 'a ordem decide quem vence e quando o prazo estende' },
  { icone: ICONES.ramos, titulo: 'Um lance alimenta vários consumidores', detalhe: 'avisos, agendador e, no futuro, antifraude' },
  { icone: ICONES.historico, titulo: 'Dá para reprocessar', detalhe: 'consumidor novo ou que falhou relê os eventos' },
] as const

export function TelaAdrKafkaContexto({ oculta }: { oculta: boolean }) {
  const [n, setN] = useState(0)
  const [iniciado, setIniciado] = useState(false)
  const rodando = iniciado && n < PICO.length
  useEffect(() => {
    if (!rodando) return
    const t = setTimeout(() => setN((x) => x + 1), 140)
    return () => clearTimeout(t)
  }, [n, rodando])
  const disparar = () => { setN(0); setIniciado(true) }
  const deA = PICO.slice(0, n).filter((e) => e.startsWith('A'))
  return (
    <section className="tela-extra" id="adr4-contexto" aria-labelledby="adr4-contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Contexto</p>
      <h2 className="secao-titulo" id="adr4-contexto-titulo">Muitos lances de uma vez, cada leilão na sua ordem</h2>
      <div className="adr-contexto">
        <div className="kf-painel">
          <button type="button" className="botao botao--destaque" onClick={disparar} disabled={rodando}>⚡ Últimos segundos do leilão</button>
          <div className="kf-chuva" aria-label="lances chegando misturados, de três leilões">
            {PICO.slice(0, n).map((e) => <Ev key={e} id={e} estado="kf-ev--chega" />)}
            {n === 0 && <span className="kf-vazio">os lances de 3 leilões chegam misturados…</span>}
          </div>
          <p className="kf-ordem">
            {deA.length > 0
              ? <>…mas o leilão A precisa ser lido assim: {deA.map((e, i) => <span key={e}>{i > 0 && ' → '}<Ev id={e} /></span>)}</>
              : <>Leilões: <Ev id="A" /> <Ev id="B" /> <Ev id="C" /></>}
          </p>
        </div>
        <ol className="adr-requisitos">
          {REQUISITOS.map((r, i) => (
            <li key={r.titulo} style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
              <span className="adr-req-n">{i + 1}</span>
              <span className="adr-req-icone">{r.icone}</span>
              <span><strong>{r.titulo}</strong><small>{r.detalhe}</small></span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* ---------- tela B: fila × log, os mesmos três passos ---------- */

type Nota = 'sim' | 'parcial' | 'nao'
const SIMBOLO: Record<Nota, string> = { sim: '✓', parcial: '~', nao: '✕' }
const CRITERIOS = ['Ordem por leilão', 'Vários consumidores', 'Reprocessar', 'Picos'] as const
const PASSOS = ['Publicar', 'Consumir', 'Consumidor novo'] as const

function CartaoFila({ passo }: { passo: number }) {
  return (
    <div className="kf-sim">
      <span className="es-sim-rotulo">fila</span>
      <div className="kf-trilho">
        {passo === 1 && ['A1', 'B1', 'A2', 'B2', 'A3'].map((e) => <Ev key={e} id={e} estado="kf-ev--chega" />)}
        {passo >= 2 && <span className="kf-apagou">vazia: apagou ao entregar</span>}
        {passo === 0 && <span className="kf-vazio">—</span>}
      </div>
      {passo >= 2 && <>
        <span className="kf-consumidor">consumidor 1: <Ev id="A1" /> <Ev id="A3" /> <Ev id="B2" /></span>
        <span className="kf-consumidor">consumidor 2: <Ev id="B1" /> <Ev id="A2" /></span>
        <span className="kf-alerta">⚠ A3 pode ser tratado antes de A2</span>
      </>}
      {passo >= 3 && <span className="kf-novo kf-novo--ruim">Antifraude (novo): ✕ nada para ler</span>}
    </div>
  )
}

function CartaoLog({ passo }: { passo: number }) {
  const lido = passo >= 2 ? 'kf-ev--lido' : 'kf-ev--chega'
  return (
    <div className="kf-sim">
      <span className="es-sim-rotulo">tópico leilao.eventos · 3 partições</span>
      {[['partição 0', ['A1', 'A2', 'A3']], ['partição 1', ['B1', 'B2']], ['partição 2', []]].map(([nome, evs]) => (
        <div key={nome as string} className="kf-particao">
          <span>{nome as string}</span>
          <div className="kf-trilho">{passo >= 1 && (evs as string[]).map((e) => <Ev key={e} id={e} estado={lido} />)}</div>
        </div>
      ))}
      {passo >= 2 && <span className="kf-consumidor">Avisos leu, em ordem: <Ev id="A1" /> → <Ev id="A2" /> → <Ev id="A3" /> · os eventos <b>continuam lá</b></span>}
      {passo >= 3 && <span className="kf-novo">Antifraude (novo): ✓ relê do início</span>}
    </div>
  )
}

const OPCOES = [
  { nome: 'Fila (RabbitMQ, SQS)', resumo: 'entrega a mensagem e a remove da fila', sim: (p: number) => <CartaoFila passo={p} />,
    notas: [['parcial', 'exige topologia complexa'], ['parcial', 'uma fila por consumidor'], ['nao', 'apagou, não tem replay'], ['sim', 'absorve o pico']] as [Nota, string][],
    veredito: 'apaga após o consumo e complica a ordem por leilão' },
  { nome: 'Log retido (Apache Kafka)', resumo: 'guarda os eventos em disco, em partições ordenadas', sim: (p: number) => <CartaoLog passo={p} />, escolhida: true,
    notas: [['sim', 'mesmo leilão, mesma partição'], ['sim', 'cada um lê no seu tempo'], ['sim', 'relê dentro da retenção'], ['sim', 'guarda em disco']] as [Nota, string][] },
]

export function TelaAdrKafkaOpcoes({ oculta }: { oculta: boolean }) {
  const [passo, setPasso] = useState(0)
  return (
    <section className="tela-extra" id="adr4-opcoes" aria-labelledby="adr4-opcoes-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Opções</p>
      <div className="es-titulo-linha">
        <h2 className="secao-titulo" id="adr4-opcoes-titulo">Fila ou log?</h2>
        <div className="kf-passos">
          {PASSOS.map((p, i) => (
            <button key={p} type="button" className={passo === i + 1 ? 'botao botao--destaque' : 'botao'} onClick={() => setPasso(i + 1)} disabled={i + 1 > passo + 1}>
              {i + 1}. {p}
            </button>
          ))}
          <button type="button" className="botao" onClick={() => setPasso(0)} title="Recomeçar">↺</button>
        </div>
      </div>
      <ol className="adr-opcoes kf-opcoes">
        {OPCOES.map((o, i) => (
          <li key={o.nome} className={o.escolhida ? 'adr-opcao adr-opcao--escolhida' : 'adr-opcao'} style={{ animationDelay: `${0.15 + i * 0.25}s` }}>
            {o.escolhida && <span className="adr-selo">✓ decisão</span>}
            <h3>{o.nome}</h3>
            <p className="adr-resumo">{o.resumo}</p>
            {o.sim(passo)}
            <ul className="adr-notas" aria-label="Critérios">
              {o.notas.map(([nota, texto], j) => (
                <li key={j} className={`adr-nota adr-nota--${nota}`}>
                  <span className="adr-nota-req kf-req">{CRITERIOS[j]}</span>
                  <span className="adr-nota-simbolo" aria-label={nota}>{SIMBOLO[nota]}</span>
                  {texto}
                </li>
              ))}
            </ul>
            {o.veredito && <p className="adr-veredito">por que não: {o.veredito}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- tela C: decisão, outbox e chave do leilão ---------- */

type Teste = 'nenhum' | 'kafkaFora' | 'repetido'

const CUSTOS = [
  ['Evento pode chegar 2× (pelo menos uma vez)', 'o repetido é ignorado'],
  ['Consumidor atrasado (lag) atrasa o encerramento', 'atraso monitorado na Kafka UI'],
] as const

const GARANTIAS = ['evento repetido não gera aviso em dobro', 'nem comando do agendador em dobro', 'Kafka UI: mesmo leilão, mesma partição, em ordem', 'Kafka UI: atraso de cada consumidor'] as const

export function TelaAdrKafkaDecisao({ oculta }: { oculta: boolean }) {
  const [comOutbox, setComOutbox] = useState(true)
  const [teste, setTeste] = useState<Teste>('nenhum')
  const [rodada, setRodada] = useState(0)
  const rodar = (t: Teste) => { setTeste(t); setRodada((r) => r + 1) }
  const perdeu = teste === 'kafkaFora' && !comOutbox

  return (
    <section className="tela-extra" id="adr4-decisao" aria-labelledby="adr4-decisao-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Decisão (aceita)</p>
      <h2 className="secao-titulo" id="adr4-decisao-titulo">Kafka, chave = leilão, e nada se perde no caminho</h2>

      <div className="kf-decisao">
        <div className="cf-palco kf-outbox">
          <div className="kf-chave">
            <span className="es-sim-rotulo">como o evento chega ao Kafka</span>
            <label className="kf-alternar"><input type="checkbox" checked={comOutbox} onChange={(e) => { setComOutbox(e.target.checked); setTeste('nenhum') }} /> com outbox</label>
          </div>
          <div className="kf-fluxo" key={rodada}>
            <span className="kf-no">leilao-escrita</span><b>→</b>
            <span className="kf-no kf-no--banco">PostgreSQL<small>{comOutbox ? 'evento + outbox juntos' : 'só o evento'}</small></span><b>→</b>
            {comOutbox && <><span className={teste === 'kafkaFora' ? 'kf-no kf-no--espera' : 'kf-no'}>outbox<small>{teste === 'kafkaFora' ? 'espera e tenta de novo' : 'envia ao Kafka'}</small></span><b>→</b></>}
            <span className={teste === 'kafkaFora' ? 'kf-no kf-no--fora' : 'kf-no kf-no--kafka'}>Kafka<small>{teste === 'kafkaFora' ? '💥 fora do ar' : 'leilao.eventos'}</small></span><b>→</b>
            <span className={perdeu ? 'kf-no kf-no--fora' : 'kf-no'}>consumidores<small>{perdeu ? 'nunca ficam sabendo' : teste === 'repetido' ? 'recebem 2×, avisam 1×' : 'consomem'}</small></span>
          </div>
          <div className="kf-botoes">
            <button type="button" className="botao" onClick={() => rodar('kafkaFora')}>💥 Kafka cai no meio</button>
            <button type="button" className="botao" onClick={() => rodar('repetido')}>↺ Mesmo evento chega 2×</button>
          </div>
          <p className={`esd-resultado ${teste === 'nenhum' ? 'esd-resultado--nenhum' : perdeu ? 'esd-resultado--update' : 'esd-resultado--concorrencia'}`} role="status" key={`r${rodada}`}>
            {teste === 'nenhum' && <>Teste com e sem outbox.</>}
            {teste === 'kafkaFora' && comOutbox && <><strong>Nada se perde:</strong> espera no outbox e sai quando o Kafka volta.</>}
            {perdeu && <><strong>Evento perdido:</strong> gravado no banco, nunca publicado.</>}
            {teste === 'repetido' && <><strong>Aviso sai uma vez só:</strong> o repetido é ignorado.</>}
          </p>
        </div>

        <div className="cf-palco kf-particoes">
          <span className="es-sim-rotulo">chave = id do leilão · 3 partições</span>
          {[['A', 0], ['B', 1], ['C', 2]].map(([l, p]) => (
            <div key={l} className="kf-mapa"><Ev id={`${l}1`} /><Ev id={`${l}2`} /><Ev id={`${l}3`} /><b>→</b><span>partição {p}</span></div>
          ))}
          <p className="kf-mapa-nota">mesmo leilão, mesma partição: <strong>sempre em ordem</strong>. Leilões diferentes, em paralelo.</p>
          <p className="kf-mapa-nota">tópicos: <code>leilao.eventos</code> e <code>leilao.comandos-agendador</code></p>
        </div>
      </div>

      <p className="esd-ganhos">✓ ordem por leilão <span>✓ consumidor lento não atrasa os lances</span> <span>✓ replay dentro da retenção</span></p>

      <div className="esd-baixo">
        <div>
          <p className="dec-rotulo">O que custa → como resolvemos</p>
          <ul className="esd-itens">{CUSTOS.map(([k, m]) => <li key={k}>{k} <b>→ {m}</b></li>)}</ul>
        </div>
        <div>
          <p className="dec-rotulo">Como garantimos</p>
          <ul className="esd-itens esd-itens--ok">{GARANTIAS.map((k) => <li key={k}>{k}</li>)}</ul>
        </div>
      </div>
    </section>
  )
}
