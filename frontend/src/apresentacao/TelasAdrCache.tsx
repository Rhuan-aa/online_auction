import { useEffect, useState, type ReactNode } from 'react'
import { ICONES } from './icones.tsx'

const TITULO = 'ADR-003 · Uso de caching versionado para obter o estado dos leilões'
const CHECKPOINT_A_CADA = 50 // leilao.checkpoint.a-cada-eventos
const MS_POR_EVENTO = 16 // ritmo da animação: cada evento relido "custa" um passo

/**
 * Anima a leitura de `n` eventos, um por passo; `lidos` vai de 0 a n.
 * `ler(n)` recomeça. Com n = 0 termina na hora (não há o que reler).
 */
function useLeitura() {
  const [lidos, setLidos] = useState(0)
  const [alvo, setAlvo] = useState(0)
  const [rodada, setRodada] = useState(0)
  useEffect(() => {
    if (lidos >= alvo) return
    const passo = Math.max(1, Math.ceil(alvo / 130)) // leilões grandes andam mais de um por passo, para não arrastar
    const t = setTimeout(() => setLidos((l) => Math.min(alvo, l + passo)), MS_POR_EVENTO)
    return () => clearTimeout(t)
  }, [lidos, alvo])
  const ler = (n: number) => { setLidos(0); setAlvo(n); setRodada((r) => r + 1) }
  return { lidos, alvo, rodada, lendo: lidos < alvo, ler }
}

interface Marca { pos: number; tipo: 'redis' | 'checkpoint' }

/**
 * A fila de eventos do leilão, um quadradinho por evento.
 * Antes de `inicio`: já está na cópia (não precisa reler). De `inicio` em diante: acende conforme `lidos`.
 */
function Fila({ total, inicio, lidos, marcas = [], pequena = false, iniciou }: {
  total: number; inicio: number; lidos: number; marcas?: readonly Marca[]; pequena?: boolean; iniciou: boolean
}) {
  return (
    <div className={pequena ? 'cf-fila cf-fila--pequena' : 'cf-fila'} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        const marca = marcas.find((m) => m.pos === i + 1)
        let estado = 'cf-q'
        if (iniciou && i < inicio) estado += ' cf-q--copia'
        else if (iniciou && i < inicio + lidos) estado += ' cf-q--lido'
        if (marca) estado += ` cf-q--${marca.tipo}`
        return <i key={i} className={estado} />
      })}
    </div>
  )
}

/* ---------- tela A: o problema ---------- */

const TAMANHOS = [10, 100, 300] as const

export function TelaAdrCacheContexto({ oculta }: { oculta: boolean }) {
  const [total, setTotal] = useState<number>(100)
  const leitura = useLeitura()
  const iniciou = leitura.rodada > 0
  const trocar = (n: number) => { setTotal(n); leitura.ler(0) }
  return (
    <section className="tela-extra" id="adr3-contexto" aria-labelledby="adr3-contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Contexto</p>
      <h2 className="secao-titulo" id="adr3-contexto-titulo">Sem cópia, cada pergunta relê o leilão inteiro</h2>

      <div className="cf-palco">
        <div className="cf-controles">
          <span className="cf-legenda">o leilão tem</span>
          {TAMANHOS.map((n) => (
            <button key={n} type="button" className={total === n ? 'botao botao--destaque' : 'botao'} onClick={() => trocar(n)}>{n} eventos</button>
          ))}
          <button type="button" className="botao botao--destaque cf-acao" onClick={() => leitura.ler(total)} disabled={leitura.lendo}>
            ▶ Chega um lance: quem está ganhando?
          </button>
        </div>
        <Fila total={total} inicio={0} lidos={leitura.lidos} iniciou={iniciou} />
        <p className="cf-status" role="status">
          {!iniciou && <>Cada quadradinho é um evento do leilão. Clique para o sistema descobrir o estado.</>}
          {iniciou && leitura.lendo && <>Relendo o evento <strong>{leitura.lidos}</strong> de {total}…</>}
          {iniciou && !leitura.lendo && leitura.alvo > 0 && <>✓ Pronto, mas precisou reler <strong>{total} eventos</strong>. No próximo lance, tudo de novo.</>}
        </p>
      </div>

      <ul className="cf-dores">
        <li><span>{ICONES.raio}</span><strong>Quanto mais lances, mais leitura</strong></li>
        <li><span>{ICONES.relogio}</span><strong>Nos segundos finais: muitos lances, cada um relê tudo</strong></li>
        <li><span>{ICONES.desligado}</span><strong>Depois de religar: nada pronto na memória</strong></li>
      </ul>
    </section>
  )
}

/* ---------- tela B: três faixas, o mesmo lance ---------- */

const N = 123 // tamanho do leilão de exemplo nas telas B e C

export function TelaAdrCacheOpcoes({ oculta }: { oculta: boolean }) {
  const reler = useLeitura()
  const cache = useLeitura()
  const [rodou, setRodou] = useState(false)
  const correr = () => { setRodou(true); reler.ler(N); cache.ler(1) }
  const faixas = [
    { nome: 'Reler sempre tudo', fila: <Fila total={N} inicio={0} lidos={reler.lidos} pequena iniciou={rodou} />,
      lidos: rodou ? reler.lidos : null, veredito: '✕ lento justamente quando mais importa', classe: 'cf-faixa--ruim' },
    { nome: 'Modelo de leitura (CQRS)', fila: <div className="cf-cqrs"><span>banco de escrita</span><b>→ copia cada evento →</b><span>2º banco, 2º modelo</span></div>,
      lidos: rodou ? 0 : null, veredito: '~ rápido, mas são dois modelos e dois bancos para manter', classe: 'cf-faixa--meio' },
    { nome: 'Cópia do estado (cache)', fila: <Fila total={N} inicio={N - 1} lidos={cache.lidos} marcas={[{ pos: N - 1, tipo: 'redis' }]} pequena iniciou={rodou} />,
      lidos: rodou ? cache.lidos : null, veredito: '✓ parte da cópia e lê só o evento novo', classe: 'cf-faixa--boa', escolhida: true },
  ]
  return (
    <section className="tela-extra" id="adr3-opcoes" aria-labelledby="adr3-opcoes-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Opções</p>
      <div className="es-titulo-linha">
        <h2 className="secao-titulo" id="adr3-opcoes-titulo">O mesmo lance, três jeitos de obter o estado</h2>
        <button type="button" className="botao botao--destaque" onClick={correr} disabled={reler.lendo}>▶ Chega o lance {N}</button>
      </div>
      <ol className="cf-faixas">
        {faixas.map((f) => (
          <li key={f.nome} className={`cf-faixa ${f.classe}`}>
            <strong className="cf-faixa-nome">{f.nome}{f.escolhida && <span className="cf-selo">✓ decisão</span>}</strong>
            <div className="cf-faixa-fila">{f.fila}</div>
            <span className="cf-faixa-lidos">{f.lidos === null ? '—' : <><b>{f.lidos}</b> {f.lidos === 1 ? 'relido' : 'relidos'}</>}</span>
            <span className="cf-faixa-veredito">{f.veredito}</span>
          </li>
        ))}
      </ol>
      <p className="cf-legenda-cores"><i className="cf-q cf-q--copia" /> já estava na cópia <i className="cf-q cf-q--lido" /> precisou reler <i className="cf-q" /> nem foi preciso</p>
      <div className="cf-ttl">
        <p className="dec-rotulo">Como saber se a cópia está velha?</p>
        <div className="cf-ttl-linha cf-ttl-linha--ruim">
          <strong className="cf-ttl-nome">⏱ Por tempo (TTL)</strong>
          <span>cópia de 10 s atrás</span>
          <b aria-hidden="true">→</b>
          <span>mostra <strong>Ana R$ 150</strong>, mas o Bruno já deu R$ 170</span>
          <em>✕ errado</em>
        </div>
        <div className="cf-ttl-linha cf-ttl-linha--boa">
          <strong className="cf-ttl-nome">🔖 Por versão (escolhido)</strong>
          <span>cópia até o evento 120 + lê 121 a 123</span>
          <b aria-hidden="true">→</b>
          <span>mostra <strong>Bruno R$ 170</strong></span>
          <em>✓ certo</em>
        </div>
      </div>
    </section>
  )
}

/* ---------- tela C: decisão, as fontes como barras e o estado montado ---------- */

type Cenario = 'normal' | 'redis' | 'apagar'
const CKPT = Math.floor(N / CHECKPOINT_A_CADA) * CHECKPOINT_A_CADA

const CENARIOS: Record<Cenario, { inicio: number; de: string; fim: string }> = {
  normal: { inicio: N, de: 'Redis', fim: 'Tudo pronto na memória. Responde na hora.' },
  redis: { inicio: CKPT, de: 'checkpoint', fim: 'Continua certo, só um pouco mais lento.' },
  apagar: { inicio: 0, de: 'Event Store', fim: 'Recriou as duas cópias e conferiu: ✓ igual.' },
}

const BOTOES: readonly { id: Cenario; icone: ReactNode; titulo: string; sub: string }[] = [
  { id: 'normal', icone: ICONES.raio, titulo: 'Situação normal', sub: 'Redis em dia' },
  { id: 'redis', icone: ICONES.desligado, titulo: 'Redis cai', sub: 'ou foi reiniciado' },
  { id: 'apagar', icone: ICONES.historico, titulo: 'Apagar as cópias', sub: 'ReconstrutorCache' },
]

const CUSTOS = [
  { icone: ICONES.camadas, problema: 'Manter as cópias', solucao: 'Redis: todo lance · banco: cada 50' },
  { icone: ICONES.ramos, problema: 'Pedidos ao mesmo tempo', solucao: 'só um refaz, os outros esperam' },
  { icone: ICONES.cadeado, problema: 'Redis encher', solucao: '64 MB; sai o leilão menos usado' },
  { icone: ICONES.relogio, problema: 'Consulta atrasada', solucao: 'atrasada, nunca errada' },
] as const

const GARANTIAS = ['cópia = replay do zero', 'testes com Redis desligado', 'A, B e C medidos rodando', 'ReconstrutorCache confere'] as const

/**
 * Exemplo pequeno de quem atualiza o quê: cada lance entra no Event Store e no Redis na hora;
 * o checkpoint só a cada 50. Começa em v147 para o checkpoint saltar para v150 em 3 cliques.
 */
function MiniDiagrama() {
  const [versao, setVersao] = useState(147)
  const [pulso, setPulso] = useState(0) // reinicia a animação de "atualizou"
  const ckpt = Math.floor(versao / CHECKPOINT_A_CADA) * CHECKPOINT_A_CADA
  const ckptAgora = versao === ckpt && pulso > 0
  const lance = () => { setVersao((v) => v + 1); setPulso((p) => p + 1) }
  return (
    <div className="md" aria-label="Exemplo: o que cada lance atualiza">
      <p className="dec-rotulo">Exemplo: o que cada lance atualiza</p>
      <div className="md-fluxo">
        <button type="button" className="botao botao--destaque md-lance" onClick={lance}>+ lance</button>
        <span className="md-seta" aria-hidden="true">→</span>
        <span className="md-caixa md-caixa--fonte" key={`es${pulso}`}><strong>Event Store</strong><b>v{versao}</b><small>guarda todo lance</small></span>
        <span className="md-seta" aria-hidden="true">→</span>
        <span className="md-par">
          <span className="md-caixa md-caixa--redis" key={`r${pulso}`}><strong>Redis</strong><b>v{versao}</b><small>na hora</small></span>
          <span className={ckptAgora ? 'md-caixa md-caixa--ckpt md-caixa--salvou' : 'md-caixa md-caixa--ckpt md-caixa--parado'} key={`c${ckptAgora ? pulso : 'x'}`}>
            <strong>Checkpoint</strong><b>v{ckpt}</b><small>{ckptAgora ? '✓ salvou agora' : `próximo em ${ckpt + CHECKPOINT_A_CADA - versao}`}</small>
          </span>
        </span>
      </div>
    </div>
  )
}

/** Uma fonte do estado como barra proporcional: cobre de v1 até `ate`. */
function Fonte({ nome, onde, ate, cor, fora, usada }: { nome: string; onde: string; ate: number; cor: string; fora: boolean; usada: boolean }) {
  const classe = ['cd-fonte', `cor-${cor}`, fora ? 'cd-fonte--fora' : '', usada ? 'cd-fonte--usada' : ''].join(' ')
  return (
    <div className={classe}>
      <span className="cd-fonte-nome"><strong>{nome}</strong><small>{onde}</small></span>
      <span className="cd-trilho"><span className="cd-barra" style={{ width: `${(ate / N) * 100}%` }}>{fora ? '✕ vazio' : `v1 → v${ate}`}</span></span>
      <span className="cd-fonte-marca">{usada ? '← parte daqui' : ''}</span>
    </div>
  )
}

export function TelaAdrCacheDecisao({ oculta }: { oculta: boolean }) {
  const [cenario, setCenario] = useState<Cenario>('normal')
  const leitura = useLeitura()
  const c = CENARIOS[cenario]
  const escolher = (k: Cenario) => { setCenario(k); leitura.ler(N - CENARIOS[k].inicio) }
  const relido = leitura.lidos
  const terminou = !leitura.lendo

  return (
    <section className="tela-extra" id="adr3-decisao" aria-labelledby="adr3-decisao-titulo" hidden={oculta}>
      <p className="secao-kicker">{TITULO} · Decisão (aceita)</p>
      <h2 className="secao-titulo" id="adr3-decisao-titulo">Começa da cópia mais recente e relê só o que falta</h2>

      <div className="cd-botoes">
        {BOTOES.map((b) => (
          <button key={b.id} type="button" className="esd-teste" onClick={() => escolher(b.id)} aria-pressed={cenario === b.id}>
            <span className="esd-teste-icone">{b.icone}</span><span><strong>{b.titulo}</strong><small>{b.sub}</small></span>
          </button>
        ))}
      </div>

      <div className="cf-palco cd-palco">
        <p className="dec-rotulo">De onde dá para montar o estado do leilão</p>
        <Fonte nome="Redis" onde="memória" ate={N} cor="sucesso" fora={cenario !== 'normal'} usada={c.de === 'Redis'} />
        <Fonte nome="Checkpoint" onde="PostgreSQL" ate={CKPT} cor="destaque" fora={cenario === 'apagar'} usada={c.de === 'checkpoint'} />
        <Fonte nome="Event Store" onde="eventos" ate={N} cor="tinta" fora={false} usada={c.de === 'Event Store'} />

        <div className="cd-montado">
          <span className="cd-fonte-nome"><strong>Estado montado</strong><small>lance {N}</small></span>
          <span className="cd-trilho cd-trilho--montado" aria-label={`${c.inicio} eventos vieram da cópia, ${relido} relidos`}>
            {c.inicio > 0 && <span className="cd-pronto" style={{ width: `${(c.inicio / N) * 100}%` }}>pronto da cópia</span>}
            {relido > 0 && <span className="cd-relido" style={{ width: `${(relido / N) * 100}%` }}>relido</span>}
          </span>
          <span className="cd-numero"><b>{relido}</b>{relido === 1 ? 'relido' : 'relidos'}</span>
        </div>
        <p className="cf-status cd-status" role="status">
          {terminou ? <>Parte do <strong>{c.de}</strong> e relê <strong>{N - c.inicio}</strong>. {c.fim}</> : <>Relendo a partir do <strong>{c.de}</strong>…</>}
        </p>
      </div>

      <div className="cd-baixo">
        <MiniDiagrama />
        <div>
          <p className="dec-rotulo">O que custa → como resolvemos</p>
          <ul className="cd-custos" aria-label="O que custa e como resolvemos">
            {CUSTOS.map((k) => <li key={k.problema}><strong>{k.problema}</strong> <small>→ {k.solucao}</small></li>)}
          </ul>
        </div>
      </div>
      <p className="cd-garantias"><span className="cd-garantias-rotulo">Como garantimos</span>{GARANTIAS.map((g) => <span key={g}>✓ {g}</span>)}</p>
    </section>
  )
}
