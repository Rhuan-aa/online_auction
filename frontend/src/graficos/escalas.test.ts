import { expect, test } from 'vitest'
import { dominioRaias, escalaLinear, finito, marcas, truncar } from './escalas.ts'
import { larguraEfetiva, proximaLargura } from './useLargura.ts'

test('escala mapeia extremos', () => {
  const s = escalaLinear([0, 10], [100, 0])
  expect(s(0)).toBe(100)
  expect(s(10)).toBe(0)
})
test('marcas redondas', () => expect(marcas(0, 87)).toEqual([0, 20, 40, 60, 80, 100]))
test('domínio degenerado não gera NaN', () => expect(Number.isNaN(escalaLinear([5, 5], [0, 100])(5))).toBe(false))

test('domínio das raias vai até a última marca e cobre a duração', () => {
  expect(dominioRaias(87)).toBe(100)
  expect(dominioRaias(87)).toBeGreaterThanOrEqual(87)
  expect(dominioRaias(0)).toBeGreaterThanOrEqual(1)
})
test('finito rejeita NaN e Infinity', () => {
  expect(finito(NaN)).toBeNull()
  expect(finito(Infinity)).toBeNull()
  expect(finito(3)).toBe(3)
})
test('truncar com reticências', () => {
  expect(truncar('abcdefgh', 5)).toBe('abcd…')
  expect(truncar('abc', 5)).toBe('abc')
  expect(truncar('abcdefgh', 1)).toBe('')
})
test('larguraEfetiva cai em 640 sem medida válida', () => {
  expect(larguraEfetiva(0)).toBe(640)
  expect(larguraEfetiva(undefined)).toBe(640)
  expect(larguraEfetiva(NaN)).toBe(640)
  expect(larguraEfetiva(360.4)).toBe(360)
})
test('proximaLargura ignora 0 (passo escondido) e mantém a atual', () => {
  expect(proximaLargura(820, 0)).toBe(820)
  expect(proximaLargura(820, undefined)).toBe(820)
  expect(proximaLargura(820, NaN)).toBe(820)
  expect(proximaLargura(640, 912.6)).toBe(913)
})
