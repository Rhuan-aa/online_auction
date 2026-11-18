import { expect, test } from 'vitest'
import { CAMPOS, PADRAO, validar } from './formulario.ts'

test('padrão é válido e converte dinheiro para centavos', () => {
  expect(validar(PADRAO)).toEqual({ licitantes: 20, lancesPorLicitante: 10, simultaneos: 6, leitores: 4, precoInicial: 10000, incremento: 100 })
})
test('sem limite máximo', () => {
  const r = validar({ ...PADRAO, licitantes: '5000', lancesPorLicitante: '100000', simultaneos: '512', leitores: '300' })
  expect(r).toMatchObject({ licitantes: 5000, lancesPorLicitante: 100000, simultaneos: 512, leitores: 300 })
})
test('leitores pode ser 0', () => expect(validar({ ...PADRAO, leitores: '0' })).toMatchObject({ leitores: 0 }))
test('zero não vale nos outros inteiros', () => {
  expect(validar({ ...PADRAO, licitantes: '0' })).toMatch(/^Licitantes/)
  expect(validar({ ...PADRAO, lancesPorLicitante: '0' })).toMatch(/^Lances por licitante/)
  expect(validar({ ...PADRAO, simultaneos: '0' })).toMatch(/^Lances simultâneos/)
})
test('não inteiros, negativos e vazios viram mensagem', () => {
  for (const v of ['', '1.5', '-3', 'abc', '2e3', ' ']) expect(typeof validar({ ...PADRAO, licitantes: v })).toBe('string')
  expect(validar({ ...PADRAO, leitores: '-1' })).toMatch(/^Leitores/)
})
test('dinheiro inválido vira mensagem', () => {
  expect(validar({ ...PADRAO, precoInicial: '0' })).toMatch(/^Preço inicial/)
  expect(validar({ ...PADRAO, incremento: '1,234' })).toMatch(/^Incremento/)
  expect(validar({ ...PADRAO, incremento: '0,5' })).toMatchObject({ incremento: 50 })
})
test('6 campos, cada um com uma frase de dica', () => {
  expect(CAMPOS.map((c) => c.campo)).toEqual(['licitantes', 'lancesPorLicitante', 'simultaneos', 'leitores', 'precoInicial', 'incremento'])
  for (const c of CAMPOS) expect(c.dica).toMatch(/\.$/)
})
