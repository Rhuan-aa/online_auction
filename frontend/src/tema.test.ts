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

test('tema padrão é palco mesmo com storage quebrado', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw new Error('bloqueado') } })
  expect(lerTema()).toBe('palco')
})
test('padrão palco sem nada salvo', () => expect(lerTema()).toBe('palco'))
test('valor inválido cai em palco', () => { guardado['tema-apresentacao'] = 'roxo'; expect(lerTema()).toBe('palco') })
test('o "claro" gravado pela versão antiga (outra chave) não vale', () => { guardado['tema'] = 'claro'; expect(lerTema()).toBe('palco') })
test('aplicar define o atributo e salva', () => {
  aplicarTema('claro')
  expect(dataset.tema).toBe('claro')
  expect(lerTema()).toBe('claro')
})
test('aplicar não quebra com storage que lança', () => {
  vi.stubGlobal('localStorage', { setItem: () => { throw new Error('cheio') } })
  aplicarTema('claro')
  expect(dataset.tema).toBe('claro')
})
