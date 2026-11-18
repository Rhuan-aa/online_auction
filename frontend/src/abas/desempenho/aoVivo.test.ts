import { expect, test } from 'vitest'
import { anexarPonto, taxas } from './aoVivo.ts'

test('taxa por segundo e ms médio', () => expect(taxas({ count: 10, total: 0.5, quando: 0 }, { count: 30, total: 1.5, quando: 2000 })).toEqual({ porSegundo: 10, msMedio: 50 }))
test('sem obtenções no intervalo', () => expect(taxas({ count: 5, total: 1, quando: 0 }, { count: 5, total: 1, quando: 2000 }).msMedio).toBeNull())
test('contador que recuou (serviço reiniciou) vira zero e sem média', () => {
  expect(taxas({ count: 50, total: 5, quando: 0 }, { count: 2, total: 0.1, quando: 2000 })).toEqual({ porSegundo: 0, msMedio: null })
})
test('anexarPonto mantém só os últimos N', () => {
  expect(anexarPonto([1, 2, 3], 4, 3)).toEqual([2, 3, 4])
  expect(anexarPonto([1], 2, 3)).toEqual([1, 2])
})
