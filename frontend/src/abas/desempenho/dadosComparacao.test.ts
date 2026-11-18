import { expect, test } from 'vitest'
import type { Execucao } from '../../simulacao.ts'
import type { Comparacao } from './comparacao.ts'
import { dadosComparacao } from './dadosComparacao.ts'

const backend = (tempo: number, ev: number, acerto: number | null, redis: number) => ({
  obtencoes: 10, tempoMedioMs: tempo, eventosPorObtencao: ev, acertoCache: acerto,
  porBase: { redis, checkpoint: 1, inicio: 2, fonte: 3 },
})
const exec = (b: number): Execucao => ({
  escrita: { p50: 1 * b, p95: 2 * b, p99: 3 * b, lancesPorSegundo: 5, backend: backend(b, 4 * b, null, 0) },
  leitura: { p50: 4 * b, p95: 5 * b, p99: 6 * b, consultas: 9, errosConsulta: 0, backend: backend(b, 2 * b, 0.5, 7) },
  grafico: { escrita: [{ versao: 1, ms: 2 * b }], leitura: [] },
}) as unknown as Execucao

const c = { execucoes: { A: exec(1), C: exec(3) } } as unknown as Comparacao

test('percentis por serviço: um grupo por percentil, uma série por configuração, null onde falta', () => {
  const d = dadosComparacao(c)
  expect(d.percentis.escrita[0]).toEqual({ rotulo: 'p50', valores: [{ serie: 'A', valor: 1 }, { serie: 'B', valor: null }, { serie: 'C', valor: 3 }] })
  expect(d.percentis.leitura[2].valores[2]).toEqual({ serie: 'C', valor: 18 })
})
test('métricas do backend por serviço, acerto em %', () => {
  const d = dadosComparacao(c)
  expect(d.tempoMedio[0].rotulo).toBe('escrita')
  expect(d.tempoMedio[1].valores.map((v) => v.valor)).toEqual([1, null, 3])
  expect(d.acerto[1].valores.map((v) => v.valor)).toEqual([50, null, 50])
  expect(d.acerto[0].valores[0].valor).toBeNull()
  expect(d.eventos[0].valores.map((v) => v.valor)).toEqual([4, null, 12])
})
test('origem do estado soma escrita e leitura; B ausente fica de fora', () => {
  const d = dadosComparacao(c)
  expect(d.origem.map((i) => i.rotulo)).toEqual(['A', 'C'])
  expect(d.origem[0].partes).toEqual([
    { nome: 'redis', valor: 7 }, { nome: 'checkpoint', valor: 2 }, { nome: 'início', valor: 4 }, { nome: 'fonte', valor: 6 },
  ])
})
test('curva tempo × versão por configuração', () => {
  const d = dadosComparacao(c)
  expect(d.curva.map((s) => s.nome)).toEqual(['A', 'C'])
  expect(d.curva[1].pontos).toEqual([{ x: 1, y: 6 }])
  expect(d.curva[0].cor).toBe('var(--serie-a)')
})
