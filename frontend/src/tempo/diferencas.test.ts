import { describe, expect, test } from 'vitest'
import type { EstadoLeilao } from '../api.ts'
import { mudancas, valorDoCampo } from './diferencas.ts'

const e1: EstadoLeilao = { leilaoId: 'a', titulo: 'Relógio', status: 'ABERTO', precoAtual: 1000, liderId: 'licitante-1', fimEm: '2026-01-01T10:00:00Z', versao: 7 }

describe('mudancas', () => {
  test('mostra só o que mudou', () => expect(mudancas(e1, { ...e1, precoAtual: 2000, liderId: 'licitante-2', versao: 8 })).toEqual([
    { campo: 'precoAtual', de: e1.precoAtual, para: 2000 }, { campo: 'liderId', de: e1.liderId, para: 'licitante-2' }]))
  test('primeira versão lista todos os campos', () => expect(mudancas(null, e1).length).toBeGreaterThan(3))
  test('ignora versao e leilaoId', () => {
    expect(mudancas(null, e1).map((m) => m.campo)).toEqual(['titulo', 'status', 'precoAtual', 'liderId', 'fimEm'])
  })
  test('sem mudanças devolve lista vazia', () => expect(mudancas(e1, { ...e1, versao: 8 })).toEqual([]))
})

test('valorDoCampo formata por campo', () => {
  expect(valorDoCampo('status', 'ABERTO')).toBe('Aberto')
  expect(valorDoCampo('precoAtual', null)).toBe('—')
  expect(valorDoCampo('liderId', null)).toBe('—')
  expect(valorDoCampo('titulo', 'X')).toBe('X')
  expect(valorDoCampo('precoAtual', 1000)).toContain('10,00')
})
