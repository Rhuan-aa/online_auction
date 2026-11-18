import { describe, expect, test } from 'vitest'
import { arq } from './fixtures.ts'
import { CRITERIOS, detalheIntegridade, melhores, vencedores } from './melhores.ts'

describe('melhores', () => {
  test('menor é melhor', () => expect([...melhores([4, 2, 9], 'menor')]).toEqual([1]))
  test('maior é melhor', () => expect([...melhores([4, 2, 9], 'maior')]).toEqual([2]))
  test('empates: todos vencem', () => expect([...melhores([3, 1, 1, 5], 'menor')]).toEqual([1, 2]))
  test('null e NaN são ignorados', () => expect([...melhores([null, 7, Number.NaN, 8], 'maior')]).toEqual([3]))
  test('sem nenhum valor, ninguém vence', () => expect(melhores([null, null], 'menor').size).toBe(0))
  test('zero é um valor de verdade', () => expect([...melhores([0, 0.5], 'menor')]).toEqual([0]))
})

test('critérios: tempos, operações, espaço e desatualizadas são "menor"; lances/s é "maior"', () => {
  const sentido = Object.fromEntries(CRITERIOS.map((c) => [c.id, c.sentido]))
  expect(sentido).toEqual({ tipico: 'menor', pior: 'menor', vazao: 'maior', consulta: 'menor', desatualizadas: 'menor', operacoes: 'menor', espaco: 'menor' })
})

test('vencedores por coluna', () => {
  const arqs = [
    arq('crud', { escrita: { p50: 2, p95: 9, amostras: 5 }, lancesPorSegundo: 300, espaco: { linhas: 1, eventos: 0, chavesRedis: 0, bytes: 8192 } }),
    arq('es', { escrita: { p50: 6, p95: 9, amostras: 5 }, lancesPorSegundo: 90, espaco: { linhas: 0, eventos: 80, chavesRedis: 0, bytes: 49152 } }),
    arq('es-cqrs', { leitura: { ...arq('x').leitura, consultas: 100, desatualizadas: 40 } }),
  ]
  const v = vencedores(arqs)
  expect([...v.tipico]).toEqual([0])
  expect([...v.pior]).toEqual([0, 1]) // empate em 9 ms
  expect([...v.vazao]).toEqual([0])
  expect([...v.desatualizadas]).toEqual([0, 1])
  expect([...v.espaco]).toEqual([0]) // quem não tem espaço (sem `fim`) não entra
})

describe('detalheIntegridade', () => {
  const ok = { ok: true, umVencedor: true, precoFinalCorreto: true, lancesPerdidos: 0 }
  test('tudo certo', () => expect(detalheIntegridade(ok)).toBe('Um vencedor, preço final correto e nenhum lance perdido'))
  test('lances perdidos', () => expect(detalheIntegridade({ ...ok, ok: false, lancesPerdidos: 3 })).toBe('3 lances perdidos'))
  test('singular e vários problemas', () =>
    expect(detalheIntegridade({ ok: false, umVencedor: false, precoFinalCorreto: false, lancesPerdidos: 1 }))
      .toBe('1 lance perdido; não terminou com exatamente um vencedor; preço final diferente do maior lance aceito'))
  test('detalhe do servidor vem junto', () => expect(detalheIntegridade({ ...ok, detalhe: 'x' })).toMatch(/\. x$/))
})
