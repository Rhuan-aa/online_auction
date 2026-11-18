// Fotos da corrida → dados dos gráficos (graficos/Barras e graficos/Linhas). Uma série por arquitetura,
// sempre com a cor --arq-N dela; valor null quando ainda não há medida (o gráfico mostra "—").
import type { Serie } from '../graficos/escalas.ts'
import { pctDesatualizadas, temEscrita, temLeitura } from './medidas.ts'
import { corDe, type ArqFoto } from './tipos.ts'

export interface Grupo { rotulo: string; valores: { serie: string; valor: number | null }[] }

/** nome da arquitetura → cor, para a legenda e as barras. */
export function cores(arqs: ArqFoto[]): Record<string, string> {
  return Object.fromEntries(arqs.map((a) => [a.nome, corDe(a.id)]))
}

/** Típico (p50) e pior caso (p95), agrupados por medida, uma barra por arquitetura. */
export function gruposTempos(arqs: ArqFoto[], tipo: 'escrita' | 'leitura'): Grupo[] {
  if (arqs.length === 0) return []
  const tem = tipo === 'escrita' ? temEscrita : temLeitura
  const de = (chave: 'p50' | 'p95') => arqs.map((a) => ({ serie: a.nome, valor: tem(a) ? a[tipo][chave] : null }))
  return [{ rotulo: 'Típico (p50)', valores: de('p50') }, { rotulo: 'Pior caso (p95)', valores: de('p95') }]
}

/** Um grupo só (sem rótulo embaixo: o título do gráfico já diz o que é). */
export function grupoUnico(arqs: ArqFoto[], valor: (a: ArqFoto) => number | null): Grupo[] {
  if (arqs.length === 0) return []
  return [{ rotulo: '', valores: arqs.map((a) => ({ serie: a.nome, valor: valor(a) })) }]
}

export const lancesPorSegundo = (arqs: ArqFoto[]) => grupoUnico(arqs, (a) => (a.enviados > 0 ? a.lancesPorSegundo : null))
export const operacoesPorLance = (arqs: ArqFoto[]) => grupoUnico(arqs, (a) => (a.enviados > 0 ? a.operacoes.porLance : null))
export const desatualizadas = (arqs: ArqFoto[]) => grupoUnico(arqs, pctDesatualizadas)

/** Espaço só existe no resultado final (evento `fim`); antes disso, nenhum grupo. Em KB. */
export function espaco(arqs: ArqFoto[]): Grupo[] {
  if (!arqs.some((a) => a.espaco)) return []
  return grupoUnico(arqs, (a) => (a.espaco ? a.espaco.bytes / 1024 : null))
}

/** "CRUD simples: linhas 1, eventos 0, chaves Redis 0 · …": o que foi contado junto com os bytes. */
export function contagemDoEspaco(arqs: ArqFoto[]): string {
  return arqs
    .filter((a) => a.espaco)
    .map((a) => `${a.nome}: linhas ${a.espaco!.linhas}, eventos ${a.espaco!.eventos}, chaves Redis ${a.espaco!.chavesRedis}`)
    .join(' · ')
}

/** Tempo médio de escrita por faixa de versão: uma linha por arquitetura, em ordem de versão. */
export function seriesCurva(arqs: ArqFoto[]): Serie[] {
  return arqs.map((a) => ({
    nome: a.nome,
    cor: corDe(a.id),
    pontos: [...a.curva].sort((p, q) => p.versao - q.versao).map((p) => ({ x: p.versao, y: p.ms })),
  }))
}
