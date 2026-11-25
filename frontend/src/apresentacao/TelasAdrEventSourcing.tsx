import { useState, type ReactNode } from 'react'
import { ICONES } from './icones.tsx'

/** Os 4 requisitos do contexto da ADR-002; a tela de opções avalia cada opção contra eles, na mesma ordem. */
const REQUISITOS = [
  { curto: 'Rastreável', icone: ICONES.olho, titulo: 'Todo lance registrado e rastreável', detalhe: 'quem, quando e sobre qual versão' },
  { curto: 'Imutável', icone: ICONES.cadeado, titulo: 'O que foi gravado não muda', detalhe: 'aconteceu como foi gravado' },
  { curto: 'Qualquer versão', icone: ICONES.historico, titulo: 'Recuperar qualquer versão', detalhe: 'como o leilão estava na v3?' },
  { curto: 'Consistência forte', icone: ICONES.escudo, titulo: 'Consistência forte na gravação', detalhe: 'dois lances na mesma versão: só um entra' },
] as const

/** A mesma sequência de lances usada nas três telas. */
const LANCES = [
  { quem: 'Ana', valor: 100, hora: '20:01:07' },
  { quem: 'Bruno', valor: 120, hora: '20:01:19' },
  { quem: 'Ana', valor: 150, hora: '20:01:42' },
  { quem: 'Bruno', valor: 170, hora: '20:01:58' },
] as const

/* ---------- tela A: contexto ---------- */

export function TelaAdrEsContexto({ oculta }: { oculta: boolean }) {
  return (
    <section className="tela-extra" id="adr2-contexto" aria-labelledby="adr2-contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-002 · Uso de Event Sourcing no armazenamento do sistema · Contexto</p>
      <h2 className="secao-titulo" id="adr2-contexto-titulo">O leilão é um livro-razão</h2>
      <div className="adr-contexto">
        <div className="es-razao" aria-label="Histórico do leilão: cada lance com versão, quem e quando">
          <div className="es-razao-topo"><span className="es-cadeado">{ICONES.cadeado}</span>só acrescenta, nunca apaga</div>
          <table className="es-tabela">
            <thead><tr><th>versão</th><th>quem</th><th>quando</th><th>o quê</th></tr></thead>
            <tbody>
              <tr><td>v1</td><td>vendedor</td><td>20:00:00</td><td>leilão criado</td></tr>
              {LANCES.slice(0, 3).map((l, i) => (
                <tr key={i} style={{ animationDelay: `${0.3 + i * 0.25}s` }}><td>v{i + 2}</td><td>{l.quem}</td><td>{l.hora}</td><td>lance R$ {l.valor}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="es-razao-estado">estado atual = aplicar tudo em ordem → <strong>Ana · R$ 150</strong></p>
        </div>
        <ol className="adr-requisitos">
          {REQUISITOS.map((r, i) => (
            <li key={r.curto} style={{ animationDelay: `${0.2 + i * 0.15}s` }}>
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

/* ---------- tela B: opções, com o mesmo lance aplicado nas três ---------- */

type Nota = 'sim' | 'parcial' | 'nao'
const SIMBOLO: Record<Nota, string> = { sim: '✓', parcial: '~', nao: '✕' }

/** CRUD: uma linha, sobrescrita; o valor anterior some. */
function SimCrud({ n }: { n: number }) {
  const atual = n > 0 ? LANCES[n - 1] : null
  const anterior = n > 1 ? LANCES[n - 2] : null
  return (
    <div className="es-sim">
      <span className="es-sim-rotulo">tabela leilao</span>
      <div className="es-linha" key={n}>
        <span>maior lance</span><strong className="es-pisca">{atual ? `R$ ${atual.valor}` : '—'}</strong>
        <span>vencedor</span><strong className="es-pisca">{atual ? atual.quem : '—'}</strong>
      </div>
      {anterior && <span className="es-perdido" key={`p${n}`}>R$ {anterior.valor} · {anterior.quem} <b>apagado pelo UPDATE</b></span>}
    </div>
  )
}

/** CRUD + auditoria: a linha sobrescrita e, ao lado, uma segunda cópia do histórico. */
function SimAuditoria({ n }: { n: number }) {
  const atual = n > 0 ? LANCES[n - 1] : null
  return (
    <div className="es-sim">
      <span className="es-sim-rotulo">tabela leilao</span>
      <div className="es-linha" key={n}>
        <span>maior lance</span><strong className="es-pisca">{atual ? `R$ ${atual.valor}` : '—'}</strong>
      </div>
      <span className="es-sim-rotulo">+ tabela auditoria <b className="es-copia">2ª cópia</b></span>
      <ol className="es-lista es-lista--auditoria">
        {LANCES.slice(0, n).map((l, i) => <li key={i} className={i === n - 1 ? 'es-novo' : ''}>{l.quem} · R$ {l.valor}</li>)}
      </ol>
    </div>
  )
}

/** Event Sourcing: só acrescenta eventos; o estado é derivado deles. */
function SimEventos({ n }: { n: number }) {
  const atual = n > 0 ? LANCES[n - 1] : null
  return (
    <div className="es-sim">
      <span className="es-sim-rotulo">event_store.eventos <b className="es-append">append-only</b></span>
      <ol className="es-lista">
        <li>v1 · LeilaoCriado</li>
        {LANCES.slice(0, n).map((l, i) => <li key={i} className={i === n - 1 ? 'es-novo' : ''}>v{i + 2} · Lance {l.quem} {l.valor}</li>)}
      </ol>
      <span className="es-derivado">estado = replay → <strong>{atual ? `${atual.quem} · R$ ${atual.valor}` : 'sem lances'}</strong></span>
    </div>
  )
}

interface Opcao { nome: string; resumo: string; sim: (n: number) => ReactNode; notas: readonly [Nota, string][]; escolhida?: boolean; veredito?: string }

const OPCOES: readonly Opcao[] = [
  { nome: 'CRUD', resumo: 'guarda só o registro atual', sim: (n) => <SimCrud n={n} />,
    notas: [['nao', 'só o último valor'], ['nao', 'UPDATE apaga o anterior'], ['nao', 'não há o que refazer'], ['sim', 'transação do banco']],
    veredito: 'o histórico se perde a cada UPDATE' },
  { nome: 'CRUD + auditoria', resumo: 'registro atual e uma cópia do histórico', sim: (n) => <SimAuditoria n={n} />,
    notas: [['sim', 'a auditoria guarda'], ['parcial', 'nada impede editar'], ['parcial', 'só se a cópia bater'], ['sim', 'transação do banco']],
    veredito: 'duas cópias do estado, que podem divergir' },
  { nome: 'Event Sourcing', resumo: 'o estado vem dos eventos, em ordem', sim: (n) => <SimEventos n={n} />, escolhida: true,
    notas: [['sim', 'cada lance é um evento'], ['sim', 'só INSERT, nunca UPDATE'], ['sim', 'replay até a versão'], ['sim', 'UNIQUE(leilao, versão)']] },
]

export function TelaAdrEsOpcoes({ oculta }: { oculta: boolean }) {
  const [n, setN] = useState(1)
  const proximo = n < LANCES.length ? LANCES[n] : null
  return (
    <section className="tela-extra" id="adr2-opcoes" aria-labelledby="adr2-opcoes-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-002 · Uso de Event Sourcing no armazenamento do sistema · Opções</p>
      <div className="es-titulo-linha">
        <h2 className="secao-titulo" id="adr2-opcoes-titulo">O mesmo lance, três jeitos de guardar</h2>
        <div className="es-controles">
          <button type="button" className="botao botao--destaque" onClick={() => setN((x) => x + 1)} disabled={!proximo}>
            {proximo ? `+ lance: ${proximo.quem} R$ ${proximo.valor}` : 'fim dos lances'}
          </button>
          <button type="button" className="botao" onClick={() => setN(1)} title="Recomeçar">↺</button>
        </div>
      </div>
      <ol className="adr-opcoes">
        {OPCOES.map((o, i) => (
          <li key={o.nome} className={o.escolhida ? 'adr-opcao adr-opcao--escolhida' : 'adr-opcao'} style={{ animationDelay: `${0.15 + i * 0.25}s` }}>
            {o.escolhida && <span className="adr-selo">✓ decisão</span>}
            <h3>{o.nome}</h3>
            <p className="adr-resumo">{o.resumo}</p>
            {o.sim(n)}
            <ul className="adr-notas" aria-label="Requisitos">
              {o.notas.map(([nota, texto], j) => (
                <li key={j} className={`adr-nota adr-nota--${nota}`}>
                  <span className="adr-nota-req es-req" title={REQUISITOS[j].titulo}>{REQUISITOS[j].curto}</span>
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

/* ---------- tela C: decisão, com o banco recusando o que não pode ---------- */

type Teste = 'nenhum' | 'concorrencia' | 'update'

const CUSTOS = [
  ['Reler muitos eventos fica caro', 'cache versionado (ADR-003)'],
  ['Cópias derivadas ficam atrás', 'completam pela versão'],
  ['O formato do evento muda', 'versão no nome: LanceRegistrado.v1'],
] as const

const CONFORMIDADE = [
  'trigger barra UPDATE e DELETE',
  'command_svc só tem INSERT e SELECT',
  'teste: 2 lances na mesma versão → 1 aceito',
  'ArchUnit: domínio sem Spring nem JDBC',
] as const

const RESULTADO: Record<Teste, ReactNode> = {
  nenhum: <>Teste o banco ao lado.</>,
  concorrencia: <><strong>Só um entra na v5.</strong> O outro é recusado e tenta de novo.</>,
  update: <><strong>Recusado.</strong> O que foi gravado não muda.</>,
}

export function TelaAdrEsDecisao({ oculta }: { oculta: boolean }) {
  const [teste, setTeste] = useState<Teste>('nenhum')
  const [rodada, setRodada] = useState(0) // reinicia as animações a cada clique
  const rodar = (t: Teste) => { setTeste(t); setRodada((r) => r + 1) }

  return (
    <section className="tela-extra" id="adr2-decisao" aria-labelledby="adr2-decisao-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-002 · Uso de Event Sourcing no armazenamento do sistema · Decisão (aceita)</p>
      <h2 className="secao-titulo" id="adr2-decisao-titulo">Cada lance é um evento. A versão decide quem entra.</h2>

      <div className="esd-palco">
        <div className="esd-eventos" key={rodada}>
          <span className="es-sim-rotulo"><span className="es-cadeado">{ICONES.cadeado}</span>eventos no PostgreSQL · só acrescenta</span>
          <ol className="esd-lista">
            {LANCES.slice(0, 3).map((l, i) => (
              <li key={i} className={teste === 'update' && i === 0 ? 'esd-recusado esd-tremor' : ''}>
                <b>v{i + 2}</b>{l.quem}<span>R$ {l.valor}</span>
              </li>
            ))}
            {teste === 'concorrencia' && <>
              <li className="esd-aceito"><b>v5</b>Bruno<span>R$ 170 ✓</span></li>
              <li className="esd-recusado esd-atrasado"><b>v5</b>Ana<span>R$ 160 ✕</span></li>
            </>}
          </ol>
        </div>

        <div className="esd-lado">
          <button type="button" className="esd-teste" onClick={() => rodar('concorrencia')} aria-pressed={teste === 'concorrencia'}>
            <span className="esd-teste-icone">{ICONES.raio}</span><span><strong>Dois lances na v4</strong><small>ao mesmo tempo</small></span>
          </button>
          <button type="button" className="esd-teste" onClick={() => rodar('update')} aria-pressed={teste === 'update'}>
            <span className="esd-teste-icone">{ICONES.lapis}</span><span><strong>Alterar a v2</strong><small>um UPDATE no passado</small></span>
          </button>
          <p className={`esd-resultado esd-resultado--${teste}`} role="status" key={rodada}>{RESULTADO[teste]}</p>
        </div>
      </div>

      <p className="esd-ganhos">✓ auditoria completa <span>✓ replay</span> <span>✓ viagem no tempo</span> <span>✓ nunca dois vencedores</span></p>

      <div className="esd-baixo">
        <div>
          <p className="dec-rotulo">Custos → mitigação</p>
          <ul className="esd-itens">{CUSTOS.map(([c, m]) => <li key={c}>{c} <b>→ {m}</b></li>)}</ul>
        </div>
        <div>
          <p className="dec-rotulo">Conformidade</p>
          <ul className="esd-itens esd-itens--ok">{CONFORMIDADE.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </div>
    </section>
  )
}
