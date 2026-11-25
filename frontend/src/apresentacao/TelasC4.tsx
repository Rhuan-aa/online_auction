import { useEffect, useState } from 'react'

/* ---------- diagrama genérico: caixas, ligações e um ponto que viaja ---------- */

type Cor = 'escrita' | 'broker' | 'leitura' | 'dados' | 'pessoa' | 'sistema'
interface No { id: string; x: number; y: number; w: number; h: number; nome: string; tag?: string; cor: Cor; zoom?: boolean }
interface Passo { caixa: string; texto: string }
interface Caminho { id: string; rotulo: string; passos: readonly Passo[] }

const centro = (n: No): [number, number] => [n.x + n.w / 2, n.y + n.h / 2]

/** Toca um caminho: avança um passo a cada 1,1 s. */
function useCaminho(caminhos: readonly Caminho[]) {
  const [atual, setAtual] = useState<Caminho | null>(null)
  const [passo, setPasso] = useState(0)
  useEffect(() => {
    if (!atual || passo >= atual.passos.length) return
    const t = setTimeout(() => setPasso((n) => n + 1), passo === 0 ? 100 : 1100)
    return () => clearTimeout(t)
  }, [atual, passo])
  const tocar = (id: string | null) => { setAtual(caminhos.find((c) => c.id === id) ?? null); setPasso(0) }
  const vistos = atual ? atual.passos.slice(0, passo) : []
  return { atual, vistos, tocar, fim: !!atual && passo >= atual.passos.length }
}

function Diagrama({ viewBox, nos, arestas, vistos, marcados = [], moldura, aoZoom }: {
  viewBox: string; nos: readonly No[]; arestas: readonly [string, string][]; vistos: readonly Passo[]
  marcados?: readonly string[]; moldura?: { x: number; y: number; w: number; h: number; rotulo: string }; aoZoom?: (id: string) => void
}) {
  const por = (id: string) => nos.find((n) => n.id === id)!
  const trilha = vistos.map((p) => centro(por(p.caixa)))
  const ativo = vistos.at(-1)?.caixa
  const tocando = vistos.length > 0 || marcados.length > 0
  const envolvidos = new Set([...vistos.map((p) => p.caixa), ...marcados])
  const ponto = trilha.at(-1)
  return (
    <svg className="c4d" viewBox={viewBox} role="img" aria-label="Diagrama C4">
      {moldura && <g className="c4d-moldura">
        <rect x={moldura.x} y={moldura.y} width={moldura.w} height={moldura.h} rx={16} />
        <text x={moldura.x + 18} y={moldura.y + 26}>{moldura.rotulo}</text>
      </g>}
      {arestas.map(([a, b]) => {
        const [x1, y1] = centro(por(a)); const [x2, y2] = centro(por(b))
        return <line key={a + b} x1={x1} y1={y1} x2={x2} y2={y2} className="c4d-aresta" />
      })}
      {trilha.slice(1).map(([x2, y2], i) => {
        const [x1, y1] = trilha[i]
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="c4d-trilha" />
      })}
      {nos.map((n) => {
        const classe = ['c4d-no', `c4d-no--${n.cor}`, n.id === ativo || marcados.includes(n.id) ? 'c4d-no--ativo' : '',
          tocando && !envolvidos.has(n.id) ? 'c4d-no--apagado' : '', n.zoom && aoZoom ? 'c4d-no--zoom' : ''].join(' ')
        const [cx, cy] = centro(n)
        return (
          <g key={n.id} className={classe} onClick={n.zoom && aoZoom ? () => aoZoom(n.id) : undefined}>
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} className="c4d-base" />
            <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={12} className="c4d-cor" />
            <text x={cx} y={n.tag ? cy - 4 : cy + 6} className="c4d-nome">{n.nome}</text>
            {n.tag && <text x={cx} y={cy + 17} className="c4d-tag">{n.tag}</text>}
            {n.zoom && aoZoom && <text x={cx} y={n.y + n.h - 16} className="c4d-lupa">🔍 abrir</text>}
          </g>
        )
      })}
      {ponto && <g className="c4d-ponto" style={{ transform: `translate(${ponto[0]}px, ${ponto[1]}px)` }}>
        <circle r={16} className="c4d-halo" /><circle r={8} className="c4d-bola" />
      </g>}
    </svg>
  )
}

function Controles({ caminhos, atual, tocar }: { caminhos: readonly Caminho[]; atual: Caminho | null; tocar: (id: string) => void }) {
  return (
    <div className="c4-botoes">
      {caminhos.map((c) => (
        <button key={c.id} type="button" className={atual?.id === c.id ? 'botao botao--destaque' : 'botao'} onClick={() => tocar(c.id)}>▶ {c.rotulo}</button>
      ))}
    </div>
  )
}

/** A frase do passo atual, grande, com o progresso em bolinhas. */
function Legenda({ atual, vistos, fim, vazio }: { atual: Caminho | null; vistos: readonly Passo[]; fim: boolean; vazio: string }) {
  if (!atual) return <p className="c4d-legenda c4d-legenda--vazia">{vazio}</p>
  const n = vistos.length
  return (
    <p className="c4d-legenda">
      <span className="c4d-progresso">{atual.passos.map((_, i) => <i key={i} className={i < n ? 'c4d-p c4d-p--on' : 'c4d-p'} />)}</span>
      {n > 0 && <span className="c4d-texto" key={n}>{vistos[n - 1].texto}{fim && ' ✓'}</span>}
    </p>
  )
}

interface ZoomProps { oculta: boolean; aoIrPara: (id: string) => void }

/* ---------- nível 1: contexto ---------- */

const PERFIS = [
  { id: 'vendedor', nome: 'Vendedor', faz: 'cria · cancela' },
  { id: 'licitante', nome: 'Licitante', faz: 'dá lances · acompanha ao vivo' },
  { id: 'adm', nome: 'ADM', faz: 'simula carga · mede' },
] as const

export function TelaC4Contexto({ oculta, aoIrPara }: ZoomProps) {
  const [i, setI] = useState(1)
  const [auto, setAuto] = useState(true)
  useEffect(() => {
    if (!auto || oculta) return
    const t = setInterval(() => setI((x) => (x + 1) % PERFIS.length), 2600)
    return () => clearInterval(t)
  }, [auto, oculta])
  const p = PERFIS[i]
  const y = (k: number) => 40 + k * 130
  return (
    <section className="tela-extra" id="c4-contexto" aria-labelledby="c4-contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">C4 · Nível 1 · Contexto</p>
      <h2 className="secao-titulo" id="c4-contexto-titulo">Três perfis, um sistema, nada externo</h2>
      <svg className="c4d c4d--n1" viewBox="0 0 1000 420" role="img" aria-label={`${p.nome} usa o sistema para: ${p.faz}`}>
        {PERFIS.map((x, k) => (
          <line key={x.id} x1={260} y1={y(k) + 38} x2={470} y2={208} className={k === i ? 'c4d-trilha' : 'c4d-aresta'} />
        ))}
        {PERFIS.map((x, k) => (
          <g key={x.id} className={`c4d-no c4d-no--pessoa${k === i ? ' c4d-no--ativo' : ''}`} onClick={() => { setAuto(false); setI(k) }} style={{ cursor: 'pointer' }}>
            <rect x={30} y={y(k)} width={230} height={76} rx={38} className="c4d-base" />
            <rect x={30} y={y(k)} width={230} height={76} rx={38} className="c4d-cor" />
            <circle cx={72} cy={y(k) + 28} r={11} className="c4d-boneco" />
            <path d={`M54 ${y(k) + 60} a18 16 0 0 1 36 0`} className="c4d-boneco" />
            <text x={165} y={y(k) + 45} className="c4d-nome">{x.nome}</text>
          </g>
        ))}
        <g className="c4d-no c4d-no--sistema c4d-no--zoom" onClick={() => aoIrPara('c4-conteineres')}>
          <rect x={470} y={40} width={500} height={336} rx={18} className="c4d-base" />
          <rect x={470} y={40} width={500} height={336} rx={18} className="c4d-cor" />
          <text x={720} y={150} className="c4d-nome c4d-nome--grande">Sistema de Leilão Online</text>
          <text x={720} y={182} className="c4d-tag">lances em tempo real · anti-sniping de 30 s</text>
          <g key={p.id} className="c4d-acao">
            <rect x={530} y={222} width={380} height={58} rx={29} />
            <text x={720} y={258}>{p.faz}</text>
          </g>
          <text x={720} y={352} className="c4d-lupa">🔍 clique para ver por dentro</text>
        </g>
        <circle r={9} className="c4d-bola" key={p.id}>
          <animateMotion dur="1.3s" repeatCount="indefinite" path={`M260 ${y(i) + 38} L470 208`} />
        </circle>
      </svg>
      <p className="c4-chips"><span>✕ sem pagamento</span><span>✕ sem login externo</span><span>usuários fixos</span></p>
    </section>
  )
}

/* ---------- nível 2: contêineres ---------- */

const N2: readonly No[] = [
  { id: 'front', x: 30, y: 10, w: 940, h: 64, nome: 'Frontend', tag: 'React · :5173', cor: 'dados' },
  { id: 'escrita', x: 30, y: 120, w: 240, h: 340, nome: 'leilao-escrita', tag: ':8081 · comandos', cor: 'escrita', zoom: true },
  { id: 'agendador', x: 360, y: 120, w: 280, h: 58, nome: 'agendador', tag: ':8084 · prazos', cor: 'escrita' },
  { id: 'kafka', x: 360, y: 208, w: 280, h: 70, nome: 'Kafka', tag: 'eventos · chave = leilão', cor: 'broker' },
  { id: 'redis', x: 360, y: 308, w: 280, h: 58, nome: 'Redis', tag: 'cópia com versão', cor: 'dados' },
  { id: 'postgres', x: 360, y: 396, w: 280, h: 64, nome: 'PostgreSQL', tag: 'Event Store', cor: 'dados' },
  { id: 'leitura', x: 730, y: 120, w: 240, h: 340, nome: 'leilao-leitura', tag: ':8082 · consultas + SSE', cor: 'leitura' },
]
const A2: readonly [string, string][] = [['front', 'escrita'], ['front', 'leitura'], ['escrita', 'kafka'], ['agendador', 'kafka'], ['kafka', 'leitura'],
  ['escrita', 'redis'], ['leitura', 'redis'], ['escrita', 'postgres'], ['leitura', 'postgres']]

const CAMINHOS_N2: readonly Caminho[] = [
  { id: 'lance', rotulo: 'um lance', passos: [
    { caixa: 'front', texto: 'Licitante dá o lance' },
    { caixa: 'escrita', texto: 'A escrita decide' },
    { caixa: 'postgres', texto: 'Grava evento + outbox' },
    { caixa: 'redis', texto: 'Atualiza a cópia' },
    { caixa: 'kafka', texto: 'Publica o evento' },
    { caixa: 'leitura', texto: 'A leitura consome e avisa' },
    { caixa: 'front', texto: 'Todos veem por SSE' },
  ] },
  { id: 'consulta', rotulo: 'uma consulta', passos: [
    { caixa: 'front', texto: 'Alguém abre o leilão' },
    { caixa: 'leitura', texto: 'Só a leitura responde' },
    { caixa: 'redis', texto: 'Pega a cópia com versão' },
    { caixa: 'postgres', texto: 'Completa se estiver atrasada' },
    { caixa: 'front', texto: 'Na tela, sem tocar na escrita' },
  ] },
  { id: 'prazo', rotulo: 'o prazo acabou', passos: [
    { caixa: 'agendador', texto: 'O prazo acabou' },
    { caixa: 'kafka', texto: 'Comando “encerrar”' },
    { caixa: 'escrita', texto: 'Grava o encerramento' },
    { caixa: 'kafka', texto: 'Evento publicado' },
    { caixa: 'leitura', texto: 'Anuncia o vencedor' },
    { caixa: 'front', texto: 'Vencedor na tela' },
  ] },
]

export function TelaC4Conteineres({ oculta, aoIrPara }: ZoomProps) {
  const { atual, vistos, tocar, fim } = useCaminho(CAMINHOS_N2)
  return (
    <section className="tela-extra" id="c4-conteineres" aria-labelledby="c4-conteineres-titulo" hidden={oculta}>
      <p className="secao-kicker">C4 · Nível 2 · Contêineres</p>
      <div className="es-titulo-linha">
        <h2 className="secao-titulo" id="c4-conteineres-titulo">A leitura nunca chama a escrita</h2>
        <Controles caminhos={CAMINHOS_N2} atual={atual} tocar={tocar} />
      </div>
      <p className="c4-trilha"><i>🔍</i> dentro de <b>Sistema de Leilão Online</b></p>
      <div className="c4-zoom c4-zoom--sistema">
        <Diagrama viewBox="0 0 1000 470" nos={N2} arestas={A2} vistos={vistos} aoZoom={() => aoIrPara('c4-componentes')} />
      </div>
      <Legenda atual={atual} vistos={vistos} fim={fim} vazio="Escolha um caminho e acompanhe o ponto." />
    </section>
  )
}

/* ---------- nível 3: componentes do leilao-escrita ---------- */

const N3: readonly No[] = [
  { id: 'erros', x: 40, y: 50, w: 200, h: 60, nome: 'TratadorErros', tag: '422 · 409', cor: 'escrita' },
  { id: 'controller', x: 270, y: 50, w: 420, h: 60, nome: 'LeilaoController', tag: 'POST /leiloes /lances', cor: 'escrita' },
  { id: 'ouvinte', x: 720, y: 50, w: 240, h: 60, nome: 'OuvinteAgendador', tag: 'Kafka', cor: 'escrita' },
  { id: 'dominio', x: 40, y: 135, w: 200, h: 60, nome: 'Leilao', tag: 'domínio · Java puro', cor: 'leitura' },
  { id: 'servico', x: 270, y: 135, w: 690, h: 60, nome: 'ServicoLeilao', tag: 'decide · até 3 tentativas', cor: 'escrita' },
  { id: 'obter', x: 40, y: 220, w: 650, h: 60, nome: 'ObterEstado', tag: 'Redis → checkpoint → eventos', cor: 'escrita' },
  { id: 'eventstore', x: 720, y: 220, w: 240, h: 60, nome: 'EventStorePostgres', tag: 'UNIQUE', cor: 'escrita' },
  { id: 'cache', x: 40, y: 305, w: 200, h: 60, nome: 'Cache', tag: '1º', cor: 'escrita' },
  { id: 'checkpoint', x: 265, y: 305, w: 200, h: 60, nome: 'Checkpoint', tag: '2º · a cada 50', cor: 'escrita' },
  { id: 'leitor', x: 490, y: 305, w: 200, h: 60, nome: 'LeitorEventos', tag: '3º', cor: 'escrita' },
  { id: 'outbox', x: 720, y: 305, w: 240, h: 60, nome: 'PublicadorOutbox', tag: 'relay → Kafka', cor: 'escrita' },
  { id: 'redis', x: 40, y: 410, w: 200, h: 56, nome: 'Redis', cor: 'dados' },
  { id: 'postgres', x: 265, y: 410, w: 425, h: 56, nome: 'PostgreSQL', tag: 'eventos + outbox', cor: 'dados' },
  { id: 'kafka', x: 720, y: 410, w: 240, h: 56, nome: 'Kafka', cor: 'broker' },
]
const A3: readonly [string, string][] = [['controller', 'erros'], ['controller', 'servico'], ['ouvinte', 'servico'], ['servico', 'dominio'], ['servico', 'obter'],
  ['servico', 'eventstore'], ['obter', 'cache'], ['obter', 'checkpoint'], ['obter', 'leitor'], ['cache', 'redis'], ['checkpoint', 'postgres'],
  ['leitor', 'postgres'], ['eventstore', 'postgres'], ['outbox', 'kafka'], ['outbox', 'postgres']]

const CAMINHOS_N3: readonly Caminho[] = [
  { id: 'aceito', rotulo: 'lance aceito', passos: [
    { caixa: 'controller', texto: 'POST /lances' },
    { caixa: 'servico', texto: 'O serviço coordena' },
    { caixa: 'obter', texto: 'Monta o estado' },
    { caixa: 'cache', texto: 'Cópia do Redis' },
    { caixa: 'dominio', texto: 'Regras ok → evento' },
    { caixa: 'eventstore', texto: 'Grava com a versão' },
    { caixa: 'outbox', texto: 'Depois do commit…' },
    { caixa: 'kafka', texto: '…publica no Kafka' },
  ] },
  { id: 'recusado', rotulo: 'lance baixo', passos: [
    { caixa: 'controller', texto: 'Lance menor que o atual' },
    { caixa: 'servico', texto: 'Pergunta ao domínio' },
    { caixa: 'dominio', texto: 'Regra violada ✕' },
    { caixa: 'erros', texto: '422, nada gravado' },
  ] },
  { id: 'conflito', rotulo: 'dois ao mesmo tempo', passos: [
    { caixa: 'servico', texto: 'Dois lances, mesma versão' },
    { caixa: 'eventstore', texto: 'UNIQUE deixa um só' },
    { caixa: 'servico', texto: 'Relê e tenta de novo' },
    { caixa: 'erros', texto: 'Esgotou 3×? 409' },
  ] },
]

const PRINCIPIOS = [
  { titulo: 'Domínio puro', frase: 'sem Spring, Kafka ou SQL', caixas: ['dominio'] },
  { titulo: 'Infra depende do domínio', frase: 'o serviço só vê a interface', caixas: ['eventstore', 'servico'] },
  { titulo: 'Sem dual write', frase: 'evento + outbox no mesmo commit', caixas: ['eventstore', 'outbox', 'postgres'] },
] as const

export function TelaC4Componentes({ oculta }: { oculta: boolean }) {
  const { atual, vistos, tocar, fim } = useCaminho(CAMINHOS_N3)
  const [principio, setPrincipio] = useState<number | null>(null)
  const pr = principio === null ? null : PRINCIPIOS[principio]
  return (
    <section className="tela-extra" id="c4-componentes" aria-labelledby="c4-componentes-titulo" hidden={oculta}>
      <p className="secao-kicker">C4 · Nível 3 · Componentes</p>
      <div className="es-titulo-linha">
        <h2 className="secao-titulo" id="c4-componentes-titulo">Por dentro do leilao-escrita</h2>
        <Controles caminhos={CAMINHOS_N3} atual={atual} tocar={(id) => { setPrincipio(null); tocar(id) }} />
      </div>
      <p className="c4-trilha"><i>🔍</i> dentro de <b>Sistema de Leilão Online</b> ▸ <b>leilao-escrita</b></p>
      <div className="c4-zoom c4-zoom--escrita">
        <Diagrama viewBox="0 0 1000 476" nos={N3} arestas={A3} vistos={vistos} marcados={pr?.caixas ?? []}
          moldura={{ x: 20, y: 10, w: 960, h: 375, rotulo: 'leilao-escrita' }} />
      </div>
      <div className="c4-rodape">
        {pr
          ? <p className="c4d-legenda"><span className="c4d-texto" key={principio}>{pr.titulo}: {pr.frase}</span></p>
          : <Legenda atual={atual} vistos={vistos} fim={fim} vazio="Escolha um caminho ou um princípio." />}
        <div className="c4-principios">
          {PRINCIPIOS.map((p, k) => (
            <button key={p.titulo} type="button" className={principio === k ? 'botao botao--destaque' : 'botao'}
              onClick={() => { tocar(null); setPrincipio(principio === k ? null : k) }}>{k + 1}. {p.titulo}</button>
          ))}
        </div>
      </div>
    </section>
  )
}
