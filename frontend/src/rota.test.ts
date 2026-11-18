import { expect, test } from 'vitest'
import { hrefDe, lerLeilao } from './rota.ts'

test('leilão do hash', () => expect(lerLeilao('#?leilao=abc')).toBe('abc'))
test('sem leilão', () => {
  expect(lerLeilao('')).toBeNull()
  expect(lerLeilao('#')).toBeNull()
  expect(lerLeilao('#?leilao=')).toBeNull()
})
test('links antigos com aba continuam valendo', () => expect(lerLeilao('#/auditoria/2?leilao=x')).toBe('x'))
test('ida e volta com caracteres especiais', () => expect(lerLeilao(hrefDe('a b/c'))).toBe('a b/c'))
test('sem leilão o href é só #', () => expect(hrefDe(null)).toBe('#'))
