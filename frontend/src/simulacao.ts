// Simulação do painel de ADM (docs/PAINEL_ADM.md): gera lances com semente, dispara com N
// simultâneos, roda leitores em paralelo, mede no navegador e compara com /actuator/metrics
// (as métricas ficam em metricas.ts). A parte pura (gerador, plano, percentil, checagens) é
// testada em test/simulacao.test.ts; a api entra por parâmetro, para os testes não dependerem do navegador.
import type { Api, EstadoLeilao, LanceHistorico, ResultadoLance } from './api.ts'
import { diferenca, esperarLeituraAssentar, fotografarServicos, lerConfiguracao, type ResumoBackend } from './metricas.ts'

/** Parâmetros da simulação. Dinheiro em centavos. */
export interface Parametros {
  licitantes: number
  lancesPorLicitante: number
  /** 1 a 6: o navegador abre ~6 conexões por porta; acima disso os pedidos esperam na fila dele. */
  simultaneos: number
  precoInicial: number
  incrementoMin: number
  incrementoMax: number
  /** 1 a 6, pelo mesmo motivo (a leitura é outra porta, com as suas 6 conexões). */
  leitores: number
  semente: number
  /**
   * Lance acompanha o preço: envia o maior entre o valor planejado e o último preço conhecido +
   * o incremento sorteado do lance. Sem isso, o licitante que sobe mais rápido deixa os outros
   * abaixo do mínimo e quase todo lance é recusado (leilão curto). O incremento sorteado, e não o
   * mínimo, faz os lances simultâneos terem valores diferentes, e mais deles passam.
   */
  acompanharPreco: boolean
}

/** Valor efetivamente enviado (ver Parametros.acompanharPreco). */
export function valorDoLance(lance: LancePlanejado, precoConhecido: number, p: Parametros): number {
  return p.acompanharPreco ? Math.max(lance.valor, precoConhecido + lance.passo) : lance.valor
}

// ---------------------------------------------------------------- gerador e plano

/** Gerador pseudoaleatório mulberry32: mesma semente, mesma sequência em [0, 1). */
export function gerador(semente: number): () => number {
  let a = semente >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function inteiroEntre(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1))
}

/** `passo` é o incremento sorteado deste lance (valor = valor anterior do licitante + passo). */
export interface LancePlanejado { licitanteId: string; valor: number; passo: number }

export interface Plano {
  /** Lances de cada licitante, em ordem crescente de valor (passeio aleatório próprio). */
  porLicitante: LancePlanejado[][]
  /** Rotação em que os licitantes são atendidos (embaralhada pela semente). */
  ordem: number[]
}

/** A semente fixa os valores e a rotação; aceitos e recusados dependem do tempo de resposta. */
export function planejarLances(p: Parametros): Plano {
  const rand = gerador(p.semente)
  const porLicitante: LancePlanejado[][] = []
  for (let i = 0; i < p.licitantes; i++) {
    const licitanteId = `licitante-${i + 1}`
    let valor = p.precoInicial
    const lances: LancePlanejado[] = []
    for (let k = 0; k < p.lancesPorLicitante; k++) {
      const passo = inteiroEntre(rand, p.incrementoMin, p.incrementoMax)
      valor += passo
      lances.push({ licitanteId, valor, passo })
    }
    porLicitante.push(lances)
  }
  const ordem = porLicitante.map((_, i) => i)
  for (let i = ordem.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[ordem[i], ordem[j]] = [ordem[j], ordem[i]]
  }
  return { porLicitante, ordem }
}

/**
 * Envia os lances com até `simultaneos` em andamento, nunca dois do mesmo licitante ao mesmo tempo
 * (cada licitante dá os seus em ordem). Cada tarefa pega o próximo licitante livre na rotação; se
 * nenhum está livre, ela termina: os restantes já têm uma tarefa cuidando deles, então a
 * concorrência continua a máxima possível.
 */
export async function dispararLances(
  plano: Plano, simultaneos: number, enviar: (lance: LancePlanejado) => Promise<void>, parar: () => boolean,
): Promise<void> {
  const proximo = plano.porLicitante.map(() => 0)
  const ocupado = plano.porLicitante.map(() => false)
  let cursor = 0

  function escolher(): number | undefined {
    for (let passo = 0; passo < plano.ordem.length; passo++) {
      const i = plano.ordem[(cursor + passo) % plano.ordem.length]
      if (!ocupado[i] && proximo[i] < plano.porLicitante[i].length) {
        cursor = (cursor + passo + 1) % plano.ordem.length
        return i
      }
    }
    return undefined
  }

  async function tarefa() {
    for (let i = escolher(); i !== undefined && !parar(); i = escolher()) {
      ocupado[i] = true
      try {
        await enviar(plano.porLicitante[i][proximo[i]++])
      } finally {
        ocupado[i] = false
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, simultaneos) }, tarefa))
}

// ---------------------------------------------------------------- estatística

/** Percentil pelo posto mais próximo (p em 0–100). Null se não há valores. */
export function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null
  const ordenados = [...valores].sort((a, b) => a - b)
  const posto = Math.max(1, Math.ceil((p / 100) * ordenados.length))
  return ordenados[posto - 1]
}

export interface Amostra { versao: number; ms: number }
export interface Ponto { versao: number; ms: number }

/** Junta as amostras em até `faixas` faixas de versão e devolve a mediana de cada uma (para o gráfico). */
export function agregarPorVersao(amostras: Amostra[], faixas = 30): Ponto[] {
  if (amostras.length === 0) return []
  const maior = Math.max(...amostras.map((a) => a.versao))
  const largura = Math.max(1, Math.ceil((maior + 1) / faixas))
  const grupos = new Map<number, number[]>()
  for (const a of amostras) {
    const faixa = Math.floor(a.versao / largura)
    const grupo = grupos.get(faixa)
    if (grupo) grupo.push(a.ms)
    else grupos.set(faixa, [a.ms])
  }
  return [...grupos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([faixa, ms]) => ({ versao: faixa * largura + Math.floor(largura / 2), ms: percentil(ms, 50)! }))
}

// ---------------------------------------------------------------- integridade

export interface LanceAceito { versao: number; licitanteId: string; valor: number }

export interface Checagens {
  /** Líder e preço finais = autor e valor do último lance aceito. */
  umVencedor: boolean
  /** Cada 200 está no histórico (mesma versão, autor e valor) e o histórico não tem nada a mais. */
  trilhaCompleta: boolean
  /** Versões e valores do histórico estritamente crescentes. */
  ordem: boolean
  problemas: string[]
}

export function checar(
  final: Pick<EstadoLeilao, 'liderId' | 'precoAtual'>, historico: LanceHistorico[], aceitos: LanceAceito[],
): Checagens {
  const problemas: string[] = []

  const ultimo = aceitos.reduce<LanceAceito | null>((u, a) => (!u || a.versao > u.versao ? a : u), null)
  const umVencedor = ultimo
    ? final.liderId === ultimo.licitanteId && final.precoAtual === ultimo.valor
    : final.liderId === null
  if (!umVencedor) {
    problemas.push(ultimo
      ? `Líder final ${final.liderId} com ${final.precoAtual}; o último aceito foi ${ultimo.licitanteId} com ${ultimo.valor} (v${ultimo.versao}).`
      : `Nenhum lance aceito, mas o líder final é ${final.liderId}.`)
  }

  const porVersao = new Map(historico.map((l) => [l.versao, l]))
  const faltando = aceitos.filter((a) => {
    const l = porVersao.get(a.versao)
    return !l || l.licitanteId !== a.licitanteId || l.valor !== a.valor
  })
  const trilhaCompleta = faltando.length === 0 && historico.length === aceitos.length
  if (faltando.length > 0) problemas.push(`${faltando.length} lance(s) aceito(s) sem correspondência no histórico.`)
  if (historico.length !== aceitos.length) {
    problemas.push(`Histórico com ${historico.length} lance(s), mas ${aceitos.length} resposta(s) 200.`)
  }

  let ordem = true
  for (let i = 1; i < historico.length; i++) {
    if (historico[i].versao <= historico[i - 1].versao || historico[i].valor <= historico[i - 1].valor) {
      ordem = false
      problemas.push(`Histórico fora de ordem entre as versões ${historico[i - 1].versao} e ${historico[i].versao}.`)
      break
    }
  }

  return { umVencedor, trilhaCompleta, ordem, problemas }
}

// ---------------------------------------------------------------- execução

export class ErroSimulacao extends Error {
  leilaoId?: string
  constructor(mensagem: string, leilaoId?: string) {
    super(mensagem)
    this.leilaoId = leilaoId
  }
}

export interface Progresso {
  fase: string
  leilaoId?: string
  enviados: number
  total: number
  aceitos: number
  recusados: number
  conflitos: number
  erros: number
  consultas: number
}

export interface Execucao {
  id: string
  quando: string
  configuracao: string
  parametros: Parametros
  leilaoId: string
  integridade: { aceitos: number; recusados: number; conflitos: number; erros: number; checagens: Checagens }
  escrita: { p50: number | null; p95: number | null; lancesPorSegundo: number; backend: ResumoBackend }
  leitura: { p50: number | null; p95: number | null; consultas: number; errosConsulta: number; backend: ResumoBackend }
  /** Mediana do tempo no navegador por faixa de versão (nº de eventos do leilão). */
  grafico: { escrita: Ponto[]; leitura: Ponto[] }
}

const ABRIR_EM_MS = 15_000

function esperar(ms: number) {
  return new Promise((ok) => setTimeout(ok, ms))
}

/** O agendador abre o leilão: consulta a cada 500 ms; sem ABERTO em 15 s, desiste com o aviso. */
async function esperarAbrir(api: Api, leilaoId: string, interrompido: (leilaoId?: string) => void): Promise<void> {
  const limite = Date.now() + ABRIR_EM_MS
  for (;;) {
    interrompido(leilaoId)
    const estado = await api.consultarLeilao(leilaoId).catch(() => null)
    if (estado?.status === 'ABERTO') return
    if (Date.now() > limite) throw new ErroSimulacao('O leilão não abriu em 15 s. O agendador está rodando?', leilaoId)
    await esperar(500)
  }
}

/**
 * Executa uma simulação completa (PAINEL_ADM.md, "Como cada execução funciona"). `aoProgredir`
 * é chamado a cada 200 ms; o `sinal` interrompe lances e leitores.
 */
export async function executar(
  api: Api, p: Parametros, aoProgredir: (progresso: Progresso) => void, sinal: AbortSignal,
): Promise<Execucao> {
  const plano = planejarLances(p)
  const progresso: Progresso = {
    fase: 'Lendo a configuração', enviados: 0, total: p.licitantes * p.lancesPorLicitante,
    aceitos: 0, recusados: 0, conflitos: 0, erros: 0, consultas: 0,
  }
  const avisar = () => aoProgredir({ ...progresso })
  const timer = setInterval(avisar, 200)
  const interrompido = (leilaoId?: string) => {
    if (sinal.aborted) throw new ErroSimulacao('Simulação interrompida.', leilaoId)
  }

  try {
    // 1. Configuração ativa, igual nos dois serviços.
    avisar()
    const config = await lerConfiguracao(api)
    if (!config.escrita || !config.leitura) {
      throw new ErroSimulacao(`Sem resposta de /actuator/metrics na ${!config.escrita ? 'escrita (8081)' : 'leitura (8082)'}.`)
    }
    if (config.escrita !== config.leitura) {
      throw new ErroSimulacao(`A escrita está em ${config.escrita} e a leitura em ${config.leitura}. Reinicie as duas com o mesmo CACHE_CONFIGURACAO.`)
    }
    const antes = await fotografarServicos(api)

    // 2. Leilão longe do anti-sniping. O início 2 s atrás absorve diferença de relógio com o servidor.
    progresso.fase = 'Criando o leilão'
    const agora = Date.now()
    const { leilaoId } = await api.criarLeilao({
      vendedorId: 'vendedor-1',
      titulo: `Simulação ${config.escrita} · semente ${p.semente}`,
      precoInicial: p.precoInicial,
      incrementoMinimo: p.incrementoMin,
      inicioEm: new Date(agora - 2_000).toISOString(),
      fimEm: new Date(agora + 10 * 60_000).toISOString(),
    })
    progresso.leilaoId = leilaoId

    // 3. O agendador abre o leilão.
    progresso.fase = 'Esperando o agendador abrir o leilão'
    await esperarAbrir(api, leilaoId, interrompido)

    // 4 e 5. Lances e leitores ao mesmo tempo.
    progresso.fase = 'Disparando lances'
    const aceitos: LanceAceito[] = []
    const tempoEscrita: Amostra[] = []
    const tempoLeitura: Amostra[] = []
    let versaoConhecida = 0
    let precoConhecido = p.precoInicial
    let errosConsulta = 0
    let lancesTerminaram = false

    const enviar = async (planejado: LancePlanejado) => {
      const lance = { licitanteId: planejado.licitanteId, valor: valorDoLance(planejado, precoConhecido, p) }
      const t0 = performance.now()
      const r: ResultadoLance = await api.darLance(leilaoId, lance)
      const ms = performance.now() - t0
      progresso.enviados++
      if (r.tipo === 'aceito') {
        progresso.aceitos++
        aceitos.push({ versao: r.versao, ...lance })
        versaoConhecida = Math.max(versaoConhecida, r.versao)
        precoConhecido = Math.max(precoConhecido, lance.valor)
      } else if (r.tipo === 'recusado') progresso.recusados++
      else if (r.tipo === 'conflito') progresso.conflitos++
      else progresso.erros++
      // Recusados não devolvem versão: ficam na última conhecida.
      tempoEscrita.push({ versao: r.tipo === 'aceito' ? r.versao : versaoConhecida, ms })
    }

    const leitor = async () => {
      while (!lancesTerminaram && !sinal.aborted) {
        const t0 = performance.now()
        try {
          const estado = await api.consultarLeilao(leilaoId)
          tempoLeitura.push({ versao: estado.versao, ms: performance.now() - t0 })
          versaoConhecida = Math.max(versaoConhecida, estado.versao)
          precoConhecido = Math.max(precoConhecido, estado.precoAtual ?? 0)
          progresso.consultas++
        } catch {
          errosConsulta++
        }
      }
    }

    const inicio = performance.now()
    const leitores = Array.from({ length: p.leitores }, leitor)
    await dispararLances(plano, p.simultaneos, enviar, () => sinal.aborted)
    const duracaoS = (performance.now() - inicio) / 1000
    lancesTerminaram = true
    await Promise.all(leitores)
    interrompido(leilaoId)

    // 6. Estado final, histórico e checagens.
    progresso.fase = 'Conferindo a integridade'
    const ultimaVersao = aceitos.reduce((m, a) => Math.max(m, a.versao), 0)
    const final = await api.consultarLeilao(leilaoId, ultimaVersao || undefined)
    const historico = await api.historicoLances(leilaoId)
    const checagens = checar(final, historico, aceitos)

    progresso.fase = 'Lendo as métricas'
    await esperarLeituraAssentar(api)
    const depois = await fotografarServicos(api)

    const ms = (a: Amostra[]) => a.map((x) => x.ms)
    return {
      id: `${Date.now()}`,
      quando: new Date().toISOString(),
      configuracao: config.escrita,
      parametros: p,
      leilaoId,
      integridade: {
        aceitos: progresso.aceitos, recusados: progresso.recusados,
        conflitos: progresso.conflitos, erros: progresso.erros, checagens,
      },
      escrita: {
        p50: percentil(ms(tempoEscrita), 50),
        p95: percentil(ms(tempoEscrita), 95),
        lancesPorSegundo: duracaoS > 0 ? progresso.enviados / duracaoS : 0,
        backend: diferenca(antes.escrita, depois.escrita),
      },
      leitura: {
        p50: percentil(ms(tempoLeitura), 50),
        p95: percentil(ms(tempoLeitura), 95),
        consultas: progresso.consultas,
        errosConsulta,
        backend: diferenca(antes.leitura, depois.leitura),
      },
      grafico: { escrita: agregarPorVersao(tempoEscrita), leitura: agregarPorVersao(tempoLeitura) },
    }
  } finally {
    clearInterval(timer)
  }
}
