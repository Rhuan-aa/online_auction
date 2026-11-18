import { describe, expect, test } from 'vitest'
import type { EventoGravado } from '../../api.ts'
import { avancar, cqrsAtrasado, crud, ROTEIRO_KAFKA, ROTEIRO_REST, ultimosLances } from './cenarios.ts'

const ev = (versao: number, tipo: string, dados: unknown): EventoGravado =>
  ({ versao, tipo, dados, criadoEm: '2026-11-18T12:00:00Z' })
const lance = (versao: number, licitanteId: string, valor: number) => ev(versao, 'LanceRegistrado.v1', { licitanteId, valor })

const eventosReais: EventoGravado[] = [
  ev(1, 'LeilaoCriado.v1', { precoInicial: 1000 }),
  ev(2, 'LeilaoIniciado.v1', {}),
  lance(3, 'licitante-1', 1200),
  lance(4, 'licitante-2', 1500),
  lance(5, 'licitante-1', 1800),
  lance(6, 'licitante-3', 2000),
]
const lances = 4
const ultimoValor = 2000

describe('crud', () => {
  test('CRUD perde o lance anterior a cada UPDATE', () => {
    const p = crud(eventosReais)
    expect(p).toHaveLength(lances)
    expect(p.at(-1)!.linha.preco).toBe(ultimoValor)
    expect(p.at(-1)!.linha.lider).toBe('licitante-3')
    expect(p.filter((x) => x.apagado).length).toBe(lances - 1)
    expect(p[1].apagado.replace(/\s/g, ' ')).toBe('lance de licitante-1 de R$ 12,00')
    expect(p.map((x) => x.passo)).toEqual([1, 2, 3, 4])
  })
  test('sem lances não há passos', () => expect(crud([eventosReais[0]])).toEqual([]))
})

describe('cqrsAtrasado', () => {
  test('réplica fica atrás', () => {
    const p = cqrsAtrasado(eventosReais, 2)
    expect(p.some((x) => x.precoVelho)).toBe(true)
    expect(p[3]).toEqual({ passo: 4, escrita: 2000, replica: 1500, precoVelho: true })
    expect(p[0].replica).toBeNull()
  })
})

test('ultimosLances mantém só lances e limita a quantidade', () => {
  const l = ultimosLances(eventosReais, 3)
  expect(l.map((e) => e.versao)).toEqual([4, 5, 6])
})

test('avancar para no último passo', () => {
  expect(avancar(0, 3)).toBe(1)
  expect(avancar(3, 3)).toBe(3)
})

describe('roteiros fixos', () => {
  test.each([['REST', ROTEIRO_REST], ['Kafka', ROTEIRO_KAFKA]])('%s tem passos com legenda', (_n, r) => {
    expect(r.passos.length).toBeGreaterThan(0)
    for (const p of r.passos) {
      expect(p.legenda.length).toBeGreaterThan(0)
      expect(p.nosso.length).toBeGreaterThan(0)
      expect(p.alternativa.length).toBeGreaterThan(0)
    }
    expect(r.conclusao.length).toBeGreaterThan(0)
  })
})
