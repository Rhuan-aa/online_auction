import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { aplicarTema, lerTema } from './tema.ts'

let guardado: Record<string, string>
let dataset: Record<string, string>

beforeEach(() => {
  guardado = {}
  dataset = {}
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => guardado[k] ?? null,
    setItem: (k: string, v: string) => { guardado[k] = v },
  })
  vi.stubGlobal('document', { documentElement: { dataset } })
})
afterEach(() => vi.unstubAllGlobals())

test('tema padrão é claro mesmo com storage quebrado', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado') } })
  expect(lerTema()).toBe('claro')
})
test('padrão claro sem nada salvo', () => expect(lerTema()).toBe('claro'))
test('valor inválido cai em claro', () => { guardado['tema'] = 'roxo'; expect(lerTema()).toBe('claro') })
test('aplicar define o atributo e salva', () => {
  aplicarTema('escuro')
  expect(dataset.tema).toBe('escuro')
  expect(lerTema()).toBe('escuro')
})
test('aplicar não quebra com storage que lança', () => {
  vi.stubGlobal('localStorage', { setItem: () => { throw new Error('cheio') } })
  aplicarTema('escuro')
  expect(dataset.tema).toBe('escuro')
})
