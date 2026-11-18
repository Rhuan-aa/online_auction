import { describe, expect, test } from 'vitest'
import { arq } from './fixtures.ts'
import type { ArqFoto } from './tipos.ts'
import { CRITERIOS, detalheIntegridade, excluidas, melhores, vencedores } from './melhores.ts'

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

const INTEGRA = { ok: true, umVencedor: true, precoFinalCorreto: true, lancesPerdidos: 0 }
const valida = (id: string, o: Partial<ArqFoto> = {}) => arq(id, { status: 'terminou', integridade: INTEGRA, ...o })

describe('vencedores', () => {
  test('por coluna', () => {
    const arqs = [
      valida('crud', { escrita: { p50: 2, p95: 9, amostras: 5 }, lancesPorSegundo: 300, espaco: { linhas: 1, eventos: 0, chavesRedis: 0, bytes: 8192 } }),
      valida('es', { escrita: { p50: 6, p95: 9, amostras: 5 }, lancesPorSegundo: 90, espaco: { linhas: 0, eventos: 80, chavesRedis: 0, bytes: 49152 } }),
      valida('es-cqrs', { leitura: { ...arq('x').leitura, consultas: 100, desatualizadas: 40 } }),
    ]
    const v = vencedores(arqs)
    expect([...v.tipico]).toEqual([0])
    expect([...v.pior]).toEqual([0, 1]) // empate em 9 ms
    expect([...v.vazao]).toEqual([0])
    expect([...v.desatualizadas]).toEqual([0, 1])
    expect([...v.espaco]).toEqual([0]) // quem não tem espaço (sem `fim`) não entra
  })

  test('linha com resultado incorreto não leva ★, mesmo sendo a mais rápida', () => {
    const arqs = [
      valida('crud', { escrita: { p50: 1, p95: 2, amostras: 5 }, lancesPorSegundo: 900, integridade: { ...INTEGRA, ok: false, lancesPerdidos: 4 } }),
      valida('es', { escrita: { p50: 6, p95: 9, amostras: 5 }, lancesPorSegundo: 90 }),
    ]
    const v = vencedores(arqs)
    expect([...v.tipico]).toEqual([1])
    expect([...v.vazao]).toEqual([1])
    for (const c of CRITERIOS) expect(v[c.id].has(0)).toBe(false)
  })

  test('com erro, parada, sem lances enviados ou sem integridade também fica de fora', () => {
    const arqs = [
      valida('a', { status: 'erro', erro: 'x' }),
      valida('b', { status: 'parada' }),
      valida('c', { enviados: 0 }),
      arq('d'), // sem integridade
      valida('e', { escrita: { p50: 50, p95: 90, amostras: 5 } }),
    ]
    expect([...vencedores(arqs).tipico]).toEqual([4])
  })

  test('se ninguém é válido, ninguém vence', () => {
    const v = vencedores([valida('a', { integridade: { ...INTEGRA, ok: false } })])
    for (const c of CRITERIOS) expect(v[c.id].size).toBe(0)
  })
})

describe('excluidas', () => {
  test('lista cada linha fora da disputa com o motivo', () => {
    const lista = excluidas([
      valida('crud', { nome: 'CRUD simples', integridade: { ...INTEGRA, ok: false } }),
      valida('es', { nome: 'ES', status: 'erro' }),
      valida('x', { nome: 'X', status: 'parada' }),
      valida('y', { nome: 'Y', enviados: 0 }),
      valida('ok', { nome: 'OK' }),
    ])
    expect(lista.map((e) => [e.indice, e.nome, e.motivo])).toEqual([
      [0, 'CRUD simples', 'resultado incorreto'],
      [1, 'ES', 'terminou com erro'],
      [2, 'X', 'a corrida foi parada'],
      [3, 'Y', 'nenhum lance enviado'],
    ])
  })
  test('ninguém excluído: lista vazia', () => expect(excluidas([valida('a')])).toEqual([]))
})

test('sem lances enviados, lances/s e operações por lance viram "—" (e não "0,0")', () => {
  const a = valida('a', { enviados: 0, lancesPorSegundo: 0, operacoes: { leiturasBanco: 0, escritasBanco: 0, opsRedis: 0, porLance: 0 } })
  const c = Object.fromEntries(CRITERIOS.map((k) => [k.id, k]))
  expect(c.vazao.texto(a)).toBe('—')
  expect(c.operacoes.texto(a)).toBe('—')
  expect(c.vazao.valor(a)).toBeNull()
  expect(c.operacoes.valor(a)).toBeNull()
})

describe('detalheIntegridade', () => {
  const ok = { ok: true, umVencedor: true, precoFinalCorreto: true, lancesPerdidos: 0 }
  test('tudo certo', () => expect(detalheIntegridade(ok)).toBe('Um vencedor, preço final correto e nenhum lance perdido'))
  test('lances perdidos', () => expect(detalheIntegridade({ ...ok, ok: false, lancesPerdidos: 3 })).toBe('3 lances perdidos'))
  test('singular e vários problemas', () =>
    expect(detalheIntegridade({ ok: false, umVencedor: false, precoFinalCorreto: false, lancesPerdidos: 1 }))
      .toBe('1 lance perdido; não terminou com exatamente um vencedor; preço final diferente do maior lance aceito'))
  test('com detalhe do servidor, mostra só ele (sem repetir o nosso)', () =>
    expect(detalheIntegridade({ ...ok, ok: false, lancesPerdidos: 3, detalhe: '3 lance(s) perdido(s).' })).toBe('3 lance(s) perdido(s).'))
})
