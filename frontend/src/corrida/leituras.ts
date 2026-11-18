// "O que isso quer dizer": frases em português, calculadas dos números da corrida, para cada gráfico.
// Só afirma o que os números mostram; a causa só aparece quando é a da própria arquitetura.
import { bytes, ms, pct, pctDesatualizadas, porLanceOps, porSegundo, temEscrita, temLeitura } from './medidas.ts'
import type { ArqFoto } from './tipos.ts'

type Sentido = 'menor' | 'maior'
interface Item { nome: string; id: string; v: number }

const UMA = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const ZERO = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

/** Do melhor para o pior; ignora quem ainda não tem medida. */
export function ranking(arqs: ArqFoto[], valor: (a: ArqFoto) => number | null, sentido: Sentido): Item[] {
  const itens = arqs.flatMap((a) => {
    const v = valor(a)
    return v !== null && Number.isFinite(v) ? [{ nome: a.nome, id: a.id, v }] : []
  })
  return itens.sort((p, q) => (sentido === 'menor' ? p.v - q.v : q.v - p.v))
}

/** Quantas vezes `b` é de `a` ("2,3×"); ou a diferença em %, quando é pequena. */
function diferenca(melhor: number, pior: number, sentido: Sentido): { pequena: boolean; texto: string } {
  const [maior, menor] = sentido === 'menor' ? [pior, melhor] : [melhor, pior]
  if (menor <= 0) return { pequena: false, texto: 'muito mais' }
  const razao = maior / menor
  if (razao < 1.15) return { pequena: true, texto: `${ZERO.format((razao - 1) * 100)}%` }
  return { pequena: false, texto: `${UMA.format(razao)}×` }
}

function comparar(r: Item[], fmt: (v: number) => string, frases: {
  melhor: (i: Item) => string
  pior: (i: Item, dif: string) => string
  empate: string
}, sentido: Sentido): string[] {
  if (r.length < 2) return []
  const melhor = r[0], pior = r[r.length - 1]
  const d = diferenca(melhor.v, pior.v, sentido)
  if (d.pequena) {
    return [`${frases.empate} Diferença de só ${d.texto} entre ${melhor.nome} (${fmt(melhor.v)}) e ${pior.nome} (${fmt(pior.v)}). Aumente os lances simultâneos para separar as arquiteturas.`]
  }
  return [frases.melhor(melhor), frases.pior(pior, d.texto)]
}

export function leituraEscrita(arqs: ArqFoto[]): string[] {
  const tipico = ranking(arqs, (a) => (temEscrita(a) ? a.escrita.p50 : null), 'menor')
  const pior = ranking(arqs, (a) => (temEscrita(a) ? a.escrita.p95 : null), 'menor')
  const frases = comparar(tipico, ms, {
    melhor: (i) => `${i.nome} registra lances mais rápido: ${ms(i.v)} no caso típico.`,
    pior: (i, dif) => `${i.nome} é o mais lento para registrar: ${ms(i.v)}, ${dif} o tempo do mais rápido.`,
    empate: 'No caso típico, as arquiteturas ficaram parecidas.',
  }, 'menor')
  if (pior.length >= 2) {
    frases.push(`Nos picos (pior caso), ${pior[0].nome} segura melhor (${ms(pior[0].v)}); ${pior[pior.length - 1].nome} chega a ${ms(pior[pior.length - 1].v)}.`)
  }
  return frases
}

export function leituraConsulta(arqs: ArqFoto[]): string[] {
  const r = ranking(arqs, (a) => (temLeitura(a) ? a.leitura.p50 : null), 'menor')
  const frases = comparar(r, ms, {
    melhor: (i) => `${i.nome} lê o preço mais rápido: ${ms(i.v)} no caso típico.`,
    pior: (i, dif) => `${i.nome} é o mais lento para ler: ${ms(i.v)}, ${dif} o tempo do mais rápido.`,
    empate: 'As consultas ficaram parecidas.',
  }, 'menor')
  const es = r.find((i) => i.id === 'es')
  if (es && r.length >= 2 && es !== r[0]) frases.push(`${es.nome} precisa reler todos os eventos para responder cada consulta.`)
  return frases
}

export function leituraVazao(arqs: ArqFoto[]): string[] {
  const r = ranking(arqs, (a) => (a.enviados > 0 ? a.lancesPorSegundo : null), 'maior')
  const frases = comparar(r, porSegundo, {
    melhor: (i) => `${i.nome} deu conta de mais lances por segundo: ${porSegundo(i.v)} (1 lance a cada ${ms(1000 / i.v)}).`,
    pior: (i, dif) => `${i.nome} foi o que menos processou: ${porSegundo(i.v)}, ${dif} menos que o primeiro.`,
    empate: 'A vazão ficou parecida entre as arquiteturas.',
  }, 'maior')
  if (frases.length) frases.push('Não confunda com o tempo para registrar: cada lance pode esperar centenas de ms, mas como vários licitantes enviam ao mesmo tempo, os lances terminam bem mais seguidos.')
  return frases
}

export function leituraOperacoes(arqs: ArqFoto[]): string[] {
  const r = ranking(arqs, (a) => (a.enviados > 0 ? a.operacoes.porLance : null), 'menor')
  const frases = comparar(r, porLanceOps, {
    melhor: (i) => `${i.nome} faz menos idas ao banco e ao Redis: ${porLanceOps(i.v)}.`,
    pior: (i, dif) => `${i.nome} é o que mais trabalha por lance: ${porLanceOps(i.v)}, ${dif} o do mais econômico.`,
    empate: 'O trabalho por lance ficou parecido.',
  }, 'menor')
  if (frases.length) frases.push('Cada operação é uma ida ao banco ou ao Redis; menos operações costuma significar menos espera.')
  return frases
}

export function leituraDesatualizadas(arqs: ArqFoto[]): string[] {
  const medidas = arqs.flatMap((a) => {
    const p = pctDesatualizadas(a)
    return p === null ? [] : [{ a, p }]
  })
  if (medidas.length === 0) return []
  const frases: string[] = []
  for (const { a, p } of medidas.filter((m) => m.p > 0).sort((x, y) => y.p - x.p)) {
    if (a.id === 'crud') {
      frases.push(`${a.nome}: ${pct(p)} das consultas viram a versão voltar para trás. Não é atraso: um UPDATE sobrescreveu outro.`)
    } else if (a.id === 'es-cqrs') {
      const atraso = a.leitura.atrasoMedioMs > 0 ? ` (atraso médio de ${ms(a.leitura.atrasoMedioMs)})` : ''
      frases.push(`${a.nome}: ${pct(p)} das consultas viram um preço velho${atraso}. A projeção de leitura só é atualizada depois que o evento passa pelo Kafka.`)
    } else {
      frases.push(`${a.nome}: ${pct(p)} das consultas viram um preço velho.`)
    }
  }
  const zeradas = medidas.filter((m) => m.p === 0).map((m) => m.a.nome)
  if (zeradas.length) frases.push(`${juntar(zeradas)} ${zeradas.length > 1 ? 'leram' : 'leu'} sempre o preço atual (0%).`)
  return frases
}

export function leituraEspaco(arqs: ArqFoto[]): string[] {
  const r = ranking(arqs, (a) => a.espaco?.bytes ?? null, 'menor')
  if (r.length < 2) return []
  const menor = r[0], maior = r[r.length - 1]
  const frases = [`${menor.nome} ocupou menos espaço (${bytes(menor.v)}); ${maior.nome} ocupou mais (${bytes(maior.v)}).`]
  const comHistorico = arqs.filter((a) => (a.espaco?.eventos ?? 0) > 0).map((a) => a.nome)
  if (comHistorico.length) {
    frases.push(`${juntar(comHistorico)} ${comHistorico.length > 1 ? 'guardam' : 'guarda'} cada evento (o histórico completo, que permite voltar no tempo); o CRUD guarda só a linha atual.`)
  }
  return frases
}

/** Curva: quem ficou mais lento conforme o leilão cresceu, do primeiro ao último ponto. */
export function leituraCurva(arqs: ArqFoto[]): string[] {
  const variacoes = arqs.flatMap((a) => {
    const pts = [...a.curva].sort((p, q) => p.versao - q.versao)
    if (pts.length < 2 || pts[0].ms <= 0) return []
    const ini = pts[0].ms, fim = pts[pts.length - 1].ms
    return [{ a, ini, fim, pct: ((fim - ini) / ini) * 100 }]
  })
  if (variacoes.length === 0) return ['Poucos pontos ainda: a curva ganha um ponto a cada 10 lances aceitos.']
  variacoes.sort((x, y) => y.pct - x.pct)
  const sobe = variacoes[0], estavel = [...variacoes].sort((x, y) => Math.abs(x.pct) - Math.abs(y.pct))[0]
  const frases: string[] = []
  if (sobe.pct > 15) {
    const causa = sobe.a.id === 'es' ? ': cada lance relê todos os eventos, e eles só aumentam' : ''
    frases.push(`${sobe.a.nome} ficou ${ZERO.format(sobe.pct)}% mais lento do começo ao fim do leilão (de ${ms(sobe.ini)} para ${ms(sobe.fim)})${causa}.`)
  } else {
    frases.push('Nenhuma arquitetura ficou claramente mais lenta conforme o leilão cresceu. Com mais lances por licitante a curva fica mais longa.')
  }
  if (estavel.a !== sobe.a) frases.push(`${estavel.a.nome} foi o mais estável (variação de ${ZERO.format(Math.abs(estavel.pct))}%).`)
  frases.push('Com muitos lances simultâneos, a fila de espera também mexe na curva (no começo ela ainda está vazia): compare as arquiteturas entre si.')
  return frases
}

function juntar(nomes: string[]): string {
  return nomes.length <= 1 ? (nomes[0] ?? '') : `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`
}
