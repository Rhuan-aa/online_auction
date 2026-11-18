import { expect, test } from 'vitest'
import { escalaLinear, marcas } from './escalas.ts'

test('escala mapeia extremos', () => {
  const s = escalaLinear([0, 10], [100, 0])
  expect(s(0)).toBe(100)
  expect(s(10)).toBe(0)
})
test('marcas redondas', () => expect(marcas(0, 87)).toEqual([0, 20, 40, 60, 80, 100]))
test('domínio degenerado não gera NaN', () => expect(Number.isNaN(escalaLinear([5, 5], [0, 100])(5))).toBe(false))
