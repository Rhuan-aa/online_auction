import { expect, test } from 'vitest'
import { paraCentavos } from './formato.ts'

test('formato brasileiro', () => {
  expect(paraCentavos('100,00')).toBe(10000)
  expect(paraCentavos('1,5')).toBe(150)
  expect(paraCentavos('1.234,56')).toBe(123456)
  expect(paraCentavos('R$ 10')).toBe(1000)
  expect(paraCentavos(' 7 ')).toBe(700)
})
test('ponto como decimal quando não há vírgula', () => {
  expect(paraCentavos('123.45')).toBe(12345)
  expect(paraCentavos('0.5')).toBe(50)
})
test('ponto com 3 dígitos é milhar', () => expect(paraCentavos('1.000')).toBe(100000))
test('sem limite máximo', () => expect(paraCentavos('9.999.999,99')).toBe(999999999))
test('inválidos e não positivos viram null', () => {
  for (const t of ['', 'abc', '0', '0,00', '-5', '1,234', '1.2.3', '12,', ',5', '1e3', 'NaN']) expect(paraCentavos(t)).toBeNull()
})
