import { useEffect, useState, type ReactNode } from 'react'
import { ICONES } from './icones.tsx'

/** Os 4 requisitos do contexto da ADR-001; a tela de opções avalia cada opção contra eles, na mesma ordem. */
const REQUISITOS = [
  { curto: 'Várias partes', icone: ICONES.ramos, titulo: 'Chegar a várias partes', detalhe: 'avisos, agendador e a tela ao vivo' },
  { curto: 'Parte nova', icone: ICONES.mais, titulo: 'Parte nova sem mudar quem publica', detalhe: 'ex.: um antifraude' },
  { curto: 'Falha isolada', icone: ICONES.desligado, titulo: 'Uma parte fora do ar não trava as outras', detalhe: 'aviso falhou? o lance continua' },
  { curto: 'Releitura', icone: ICONES.fila, titulo: 'Ordem e releitura', detalhe: 'quem chega depois relê os eventos' },
] as const

/* ---------- desenhos (SVG, só tokens via classes) ---------- */

/** Caixa com texto centralizado. */
function No({ x, y, w, h, texto, sub, classe = '' }: { x: number; y: number; w: number; h: number; texto: string; sub?: string; classe?: string }) {
  return (
    <g className={`adr-no ${classe}`}>
      <rect x={x} y={y} width={w} height={h} rx={8} />
      <text x={x + w / 2} y={y + h / 2 + (sub ? -2 : 4)} textAnchor="middle">{texto}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 11} textAnchor="middle" className="adr-sub">{sub}</text>}
    </g>
  )
}

/** Seta com ponta (a ponta usa o marcador do próprio desenho). */
const Seta = ({ d, marcador, classe = '' }: { d: string; marcador: string; classe?: string }) => (
  <path d={d} className={`adr-seta ${classe}`} markerEnd={`url(#${marcador})`} />
)

const Ponta = ({ id }: { id: string }) => (
  <defs>
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" className="adr-ponta" />
    </marker>
  </defs>
)

/** Um ponto andando por um caminho (o "evento" viajando). */
const Pulso = ({ d, atraso = 0 }: { d: string; atraso?: number }) => (
  <circle r="4" className="adr-pulso">
    <animateMotion dur="2.4s" begin={`${atraso}s`} repeatCount="indefinite" path={d} />
  </circle>
)

function DesenhoContexto() {
  return (
    <svg viewBox="0 0 300 190" className="adr-desenho" role="img" aria-label="Um lance registrado precisa chegar aos avisos, ao agendador e à tela ao vivo; um antifraude pode entrar depois">
      <Ponta id="p-ctx" />
      <No x={6} y={74} w={92} h={42} texto="Lance" sub="registrado" classe="adr-no--fonte" />
      <Seta d="M98 95 C130 95 140 28 186 28" marcador="p-ctx" />
      <Seta d="M98 95 L186 76" marcador="p-ctx" />
      <Seta d="M98 95 C130 95 140 124 186 124" marcador="p-ctx" />
      <Seta d="M98 95 C130 95 140 170 186 170" marcador="p-ctx" classe="adr-seta--futura" />
      <No x={188} y={10} w={106} h={36} texto="Avisos" sub="lance superado" />
      <No x={188} y={58} w={106} h={36} texto="Agendador" sub="abre e encerra" />
      <No x={188} y={106} w={106} h={36} texto="Tela ao vivo" sub="SSE" />
      <No x={188} y={154} w={106} h={32} texto="Antifraude" sub="(futuro)" classe="adr-no--futuro" />
      <Pulso d="M98 95 C130 95 140 28 186 28" />
      <Pulso d="M98 95 L186 76" atraso={0.3} />
      <Pulso d="M98 95 C130 95 140 124 186 124" atraso={0.6} />
    </svg>
  )
}

function DesenhoRest() {
  return (
    <svg viewBox="0 0 280 170" className="adr-desenho" role="img" aria-label="O serviço de lances chama cada parte e espera; se os avisos caem, o lance trava">
      <Ponta id="p-rest" />
      <No x={4} y={62} w={80} h={46} texto="Lances" sub="⏳ espera todos" classe="adr-no--travado" />
      <Seta d="M84 78 L182 30" marcador="p-rest" classe="adr-seta--falha" />
      <Seta d="M84 85 L182 85" marcador="p-rest" />
      <Seta d="M84 92 L182 140" marcador="p-rest" />
      <No x={184} y={12} w={92} h={36} texto="Avisos" sub="✕ fora do ar" classe="adr-no--fora" />
      <No x={184} y={67} w={92} h={36} texto="Agendador" />
      <No x={184} y={122} w={92} h={36} texto="Tela ao vivo" />
      <text x={128} y={160} textAnchor="middle" className="adr-sub">chama e espera a resposta</text>
    </svg>
  )
}

function DesenhoMediador() {
  return (
    <svg viewBox="0 0 280 170" className="adr-desenho" role="img" aria-label="Um mediador central recebe o lance e conduz cada parte">
      <Ponta id="p-med" />
      <No x={2} y={66} w={62} h={38} texto="Lances" />
      <Seta d="M64 85 L100 85" marcador="p-med" />
      <No x={102} y={55} w={78} h={60} texto="Mediador" sub="conhece o fluxo" classe="adr-no--central" />
      <Seta d="M180 78 L204 30" marcador="p-med" />
      <Seta d="M180 85 L204 85" marcador="p-med" />
      <Seta d="M180 92 L204 140" marcador="p-med" />
      <No x={206} y={12} w={72} h={36} texto="Avisos" />
      <No x={206} y={67} w={72} h={36} texto="Agendador" />
      <No x={206} y={122} w={72} h={36} texto="Tela" />
      <text x={141} y={160} textAnchor="middle" className="adr-sub">parte nova = mudar o mediador</text>
    </svg>
  )
}

function DesenhoBroker() {
  return (
    <svg viewBox="0 0 280 170" className="adr-desenho" role="img" aria-label="O serviço publica no Kafka, que guarda os eventos em ordem; cada parte se inscreve e lê no seu tempo, inclusive um antifraude novo">
      <Ponta id="p-brk" />
      <No x={2} y={66} w={58} h={38} texto="Lances" />
      <Seta d="M60 85 L90 85" marcador="p-brk" />
      <g className="adr-no adr-no--central">
        <rect x={92} y={48} width={90} height={74} rx={8} />
        <text x={137} y={66} textAnchor="middle">Kafka</text>
        {[0, 1, 2, 3].map((i) => <rect key={i} x={101 + i * 18} y={78} width={15} height={15} rx={3} className="adr-evento" />)}
        <text x={137} y={112} textAnchor="middle" className="adr-sub">guarda em ordem</text>
      </g>
      <Seta d="M182 72 L204 26" marcador="p-brk" />
      <Seta d="M182 80 L204 68" marcador="p-brk" />
      <Seta d="M182 90 L204 110" marcador="p-brk" />
      <Seta d="M182 98 L204 150" marcador="p-brk" classe="adr-seta--futura" />
      <No x={206} y={10} w={72} h={32} texto="Avisos" />
      <No x={206} y={52} w={72} h={32} texto="Agendador" />
      <No x={206} y={94} w={72} h={32} texto="Tela" />
      <No x={206} y={136} w={72} h={30} texto="Antifraude" classe="adr-no--novo" />
      <Pulso d="M30 85 L90 85" />
      <Pulso d="M182 80 L204 68" atraso={0.9} />
      <Pulso d="M182 90 L204 110" atraso={1.2} />
    </svg>
  )
}

/* ---------- tela A: contexto ---------- */

export function TelaAdrBrokerContexto({ oculta }: { oculta: boolean }) {
  return (
    <section className="tela-extra" id="adr1-contexto" aria-labelledby="adr1-contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-001 · Adoção de arquitetura baseada em eventos com broker · Contexto</p>
      <h2 className="secao-titulo" id="adr1-contexto-titulo">Um lance, várias partes interessadas</h2>
      <div className="adr-contexto">
        <DesenhoContexto />
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

/* ---------- tela B: opções ---------- */

type Nota = 'sim' | 'parcial' | 'nao'
const SIMBOLO: Record<Nota, string> = { sim: '✓', parcial: '~', nao: '✕' }

interface Opcao { nome: string; resumo: string; desenho: ReactNode; notas: readonly [Nota, string][]; escolhida?: boolean; veredito?: string }

const OPCOES: readonly Opcao[] = [
  { nome: 'Chamadas REST síncronas', resumo: 'chama cada parte e espera', desenho: <DesenhoRest />,
    notas: [['sim', 'chama uma por uma'], ['nao', 'mexe no serviço de lances'], ['nao', 'Avisos caiu → lance trava'], ['nao', 'nada fica guardado']],
    veredito: 'o lance fica preso a cada consumidor' },
  { nome: 'Eventos com mediador', resumo: 'um central conduz o fluxo', desenho: <DesenhoMediador />,
    notas: [['sim', 'o mediador repassa'], ['parcial', 'mexe no mediador'], ['parcial', 'mediador caiu → tudo para'], ['parcial', 'só se o mediador guardar']],
    veredito: 'útil com compensação; o leilão não tem' },
  { nome: 'Eventos com broker', resumo: 'publica o fato; cada parte se inscreve', desenho: <DesenhoBroker />, escolhida: true,
    notas: [['sim', 'cada parte se inscreve'], ['sim', 'ninguém muda nada'], ['sim', 'Kafka guarda até voltar'], ['sim', 'em ordem, relê quando quiser']] },
]

export function TelaAdrBrokerOpcoes({ oculta }: { oculta: boolean }) {
  return (
    <section className="tela-extra" id="adr1-opcoes" aria-labelledby="adr1-opcoes-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-001 · Adoção de arquitetura baseada em eventos com broker · Opções</p>
      <h2 className="secao-titulo" id="adr1-opcoes-titulo">Como o lance chega a cada parte?</h2>
      <ol className="adr-opcoes">
        {OPCOES.map((o, i) => (
          <li key={o.nome} className={o.escolhida ? 'adr-opcao adr-opcao--escolhida' : 'adr-opcao'} style={{ animationDelay: `${0.15 + i * 0.25}s` }}>
            {o.escolhida && <span className="adr-selo">✓ decisão</span>}
            <h3>{o.nome}</h3>
            <p className="adr-resumo">{o.resumo}</p>
            {o.desenho}
            <ul className="adr-notas" aria-label="Requisitos">
              {o.notas.map(([nota, texto], j) => (
                <li key={j} className={`adr-nota adr-nota--${nota}`}>
                  <span className="adr-nota-req" title={REQUISITOS[j].titulo}>{REQUISITOS[j].curto}</span>
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

/* ---------- tela C: decisão ---------- */

const CONSUMIDORES = [
  { id: 'avisos', y: 8, texto: 'Avisos' },
  { id: 'agendador', y: 64, texto: 'Agendador' },
  { id: 'leitura', y: 120, texto: 'Leitura' },
] as const

/**
 * O fluxo escolhido: a escrita grava no Event Store, publica no Kafka (outbox) e cada parte consome no seu tempo;
 * o SSE sai da leitura, depois da gravação. `avisosFora` derruba os Avisos: os lances seguem e os eventos esperam no Kafka.
 */
function FluxoDecisao({ avisosFora, esperando }: { avisosFora: boolean; esperando: number }) {
  const ramo = (y: number) => `M478 85 C510 85 510 ${y + 20} 546 ${y + 20}`
  return (
    <svg viewBox="0 0 770 172" className="adr-desenho adr-fluxo" role="img"
      aria-label="leilao-escrita grava no Event Store, publica no Kafka; Avisos, Agendador e Leitura consomem; a Leitura envia ao navegador por SSE">
      <Ponta id="p-dec" />
      <No x={4} y={62} w={112} h={46} texto="leilao-escrita" sub={avisosFora ? '✓ lances seguem' : 'registra o lance'} classe={avisosFora ? 'adr-no--fonte adr-no--ok' : 'adr-no--fonte'} />
      <Seta d="M116 85 L168 85" marcador="p-dec" />
      <text x={142} y={76} textAnchor="middle" className="adr-passo">grava</text>
      <No x={170} y={58} w={124} h={54} texto="Event Store" sub="histórico completo" />
      <text x={232} y={126} textAnchor="middle" className="adr-adr">ADR-002</text>
      <Seta d="M294 85 L354 85" marcador="p-dec" />
      <text x={324} y={76} textAnchor="middle" className="adr-passo">publica</text>
      <g className="adr-no adr-no--central">
        <rect x={356} y={44} width={122} height={82} rx={8} />
        <text x={417} y={62} textAnchor="middle">Kafka</text>
        <text x={417} y={140} textAnchor="middle" className="adr-adr">ADR-004</text>
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={369 + i * 20} y={72} width={16} height={16} rx={3} className="adr-evento" />)}
        <text x={417} y={106} textAnchor="middle" className="adr-sub">guarda por um tempo</text>
        {avisosFora && esperando > 0 && <text x={417} y={120} textAnchor="middle" className="adr-sub adr-esperando">+{esperando} esperando os Avisos</text>}
      </g>
      {CONSUMIDORES.map((c) => {
        const fora = c.id === 'avisos' && avisosFora
        return (
          <g key={c.id}>
            <Seta d={ramo(c.y)} marcador="p-dec" classe={fora ? 'adr-seta--falha' : ''} />
            <No x={548} y={c.y} w={98} h={40} texto={c.texto} sub={fora ? '✕ fora do ar' : undefined} classe={fora ? 'adr-no--fora' : ''} />
            {!fora && <Pulso d={ramo(c.y)} atraso={c.y / 100} />}
          </g>
        )
      })}
      <Seta d="M646 140 L686 140" marcador="p-dec" />
      <No x={688} y={120} w={78} h={40} texto="Navegador" />
      <text x={666} y={170} textAnchor="middle" className="adr-passo">SSE, depois de gravar</text>
      <Pulso d="M60 85 L168 85" />
      <Pulso d="M294 85 L354 85" atraso={0.6} />
      <Pulso d="M646 140 L686 140" atraso={1.4} />
    </svg>
  )
}

const CUSTOS = [
  { icone: ICONES.relogio, custo: 'Consistência eventual', detalhe: 'a tela chega um instante depois', mitigacao: 'eventos repetidos são descartados' },
  { icone: ICONES.olho, custo: 'Depuração mais difícil', detalhe: 'um lance passa por vários serviços', mitigacao: 'Kafka UI mostra cada evento' },
] as const

const REGRAS = [
  { de: 'Notificações', para: 'Escrita' },
  { de: 'Leitura', para: 'publicar no Kafka' },
  { de: 'Escrita', para: 'Leitura / Agendador' },
] as const

export function TelaAdrBrokerDecisao({ oculta }: { oculta: boolean }) {
  const [avisosFora, setAvisosFora] = useState(false)
  const [esperando, setEsperando] = useState(0)

  // com os Avisos fora, os eventos se acumulam no Kafka; ao voltar, eles releem e a fila zera
  useEffect(() => {
    if (!avisosFora) {
      const t = setTimeout(() => setEsperando(0), 900)
      return () => clearTimeout(t)
    }
    const t = setInterval(() => setEsperando((n) => Math.min(n + 1, 99)), 700)
    return () => clearInterval(t)
  }, [avisosFora])

  return (
    <section className="tela-extra" id="adr1-decisao" aria-labelledby="adr1-decisao-titulo" hidden={oculta}>
      <p className="secao-kicker">ADR-001 · Adoção de arquitetura baseada em eventos com broker · Decisão (aceita)</p>
      <h2 className="secao-titulo" id="adr1-decisao-titulo">Publica o fato; cada parte consome no seu tempo</h2>

      <div className="dec-fluxo">
        <FluxoDecisao avisosFora={avisosFora} esperando={esperando} />
        <div className="dec-acoes">
          <button type="button" className={avisosFora ? 'botao botao--destaque' : 'botao'} onClick={() => setAvisosFora((f) => !f)} aria-pressed={avisosFora}>
            {avisosFora ? '↻ Religar Avisos' : '⏻ Derrubar Avisos'}
          </button>
          <span className="dec-ganho" role="status">
            {avisosFora
              ? <>✓ lances seguem · {esperando} evento{esperando === 1 ? '' : 's'} guardado{esperando === 1 ? '' : 's'} no Kafka</>
              : esperando > 0 ? <>↻ Avisos releem os {esperando} eventos</> : <>✓ parte nova? só se inscreve no Kafka</>}
          </span>
        </div>
      </div>

      <div className="dec-baixo">
        <div className="dec-bloco">
          <p className="dec-rotulo">Custos → como mitigamos</p>
          <ul className="dec-custos">
            {CUSTOS.map((c) => (
              <li key={c.custo}>
                <span className="dec-custo"><span className="dec-icone">{c.icone}</span><span><strong>{c.custo}</strong><small>{c.detalhe}</small></span></span>
                <span className="dec-seta" aria-hidden="true">→</span>
                <span className="dec-mitigacao">{c.mitigacao}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="dec-bloco">
          <p className="dec-rotulo">Conformidade · ArchUnit barra no build</p>
          <ul className="dec-regras">
            {REGRAS.map((r) => (
              <li key={r.de + r.para}>
                <span className="dec-modulo">{r.de}</span>
                <span className="dec-proibido" role="img" aria-label="não pode depender de" />
                <span className="dec-modulo">{r.para}</span>
              </li>
            ))}
          </ul>
          <p className="dec-nota">{ICONES.escudo} histórico protegido no próprio banco (ADR-002)</p>
        </div>
      </div>
    </section>
  )
}
