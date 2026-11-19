import { expect, test } from 'vitest'
import { descreverBarras, escalaLinear, finito, marcas, mensagemVazia, truncar } from './escalas.ts'
import { posicao } from './escalas.ts'
import { proximaLargura } from './useLargura.ts'

test('escala mapeia extremos', () => {
  const s = escalaLinear([0, 10], [100, 0])
  expect(s(0)).toBe(100)
  expect(s(10)).toBe(0)
})
test('marcas redondas', () => expect(marcas(0, 87)).toEqual([0, 20, 40, 60, 80, 100]))
test('domínio degenerado não gera NaN', () => expect(Number.isNaN(escalaLinear([5, 5], [0, 100])(5))).toBe(false))

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
test('proximaLargura ignora 0 (passo escondido) e mantém a atual', () => {
  expect(proximaLargura(820, 0)).toBe(820)
  expect(proximaLargura(820, undefined)).toBe(820)
  expect(proximaLargura(820, NaN)).toBe(820)
  expect(proximaLargura(640, 912.6)).toBe(913)
})

test('aria das barras: grupo único sem rótulo não deixa ": " solto', () => {
  expect(descreverBarras('Lances por segundo', 'maior é melhor', [{ rotulo: '', valores: [{ serie: 'CRUD', valor: 12.5 }, { serie: 'ES', valor: null }] }]))
    .toBe('Lances por segundo, em maior é melhor: CRUD 12,5, ES sem dado')
})
test('aria das barras: vários grupos com rótulo', () => {
  expect(descreverBarras('T', 'ms', [{ rotulo: 'p50', valores: [{ serie: 'A', valor: 1 }] }, { rotulo: 'p95', valores: [{ serie: 'A', valor: 3 }] }]))
    .toBe('T, em ms: p50: A 1; p95: A 3')
})
test('gráfico vazio: sem grupos, tudo null, ou com dados', () => {
  expect(mensagemVazia([])).toBe('Sem dados ainda')
  expect(mensagemVazia([{ rotulo: '', valores: [{ serie: 'A', valor: null }, { serie: 'B', valor: Number.NaN }] }])).toMatch(/Sem medições/)
  expect(mensagemVazia([{ rotulo: '', valores: [{ serie: 'A', valor: null }, { serie: 'B', valor: 0 }] }])).toBeNull()
})

test('posição no ranking e distância até o melhor', () => {
  const vs = [{ serie: 'A', valor: 10 }, { serie: 'B', valor: 14 }, { serie: 'C', valor: null }]
  const f = (v: number) => `${v} ms`
  expect(posicao(vs, 'A', 'menor', f)).toBe('1º de 2 · o melhor')
  expect(posicao(vs, 'B', 'menor', f)).toBe('2º de 2 · 40% acima do melhor, A (10 ms)')
  expect(posicao(vs, 'A', 'maior', f)).toBe('2º de 2 · 29% abaixo do melhor, B (14 ms)')
  expect(posicao(vs, 'C', 'menor', f)).toBeNull()
})
