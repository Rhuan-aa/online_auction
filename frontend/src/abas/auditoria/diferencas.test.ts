import { describe, expect, test } from 'vitest'
import type { EstadoLeilao, RelatorioReconstrucao } from '../../api.ts'
import { mudancas, passosDaReconstrucao, valorDoCampo } from './diferencas.ts'

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

const rel = (o: Partial<RelatorioReconstrucao> = {}): RelatorioReconstrucao => ({
  leiloes: 3, chavesApagadas: 5, checkpointsApagados: 2, refeitos: 3, diferentes: [],
  tempos: { fotografiaMs: 1, apagarMs: 2, refazerMs: 3, compararMs: 4 }, ...o })

describe('passosDaReconstrucao', () => {
  test('quatro etapas com os números do relatório', () => {
    const p = passosDaReconstrucao(rel())
    expect(p.map((x) => x.texto)).toEqual([
      'Fotografia: 3 leilões', 'Apagados: 5 chaves do Redis e 2 checkpoints',
      'Refeitos 3 estados a partir dos eventos', 'Idênticos ✓'])
    expect(p.map((x) => x.ms)).toEqual([1, 2, 3, 4])
  })
  test('diferenças viram aviso de cópia atrás', () => {
    const p = passosDaReconstrucao(rel({ diferentes: ['x', 'y'] }))
    expect(p[3].texto).toBe('Cópia atrás da fonte em 2 leilões — corrigida')
    expect(p[3].ok).toBe(false)
    expect(passosDaReconstrucao(rel({ diferentes: ['x'] }))[3].texto).toBe('Cópia atrás da fonte em 1 leilão — corrigida')
  })
  test('fora da configuração C o passo de refazer avisa que não há cópias', () => {
    expect(passosDaReconstrucao(rel(), 'A')[2].texto).toBe('Refeitos 3 estados (sem cópias na configuração A)')
    expect(passosDaReconstrucao(rel(), 'B')[2].texto).toBe('Refeitos 3 estados (sem cópias na configuração B)')
    expect(passosDaReconstrucao(rel(), 'C')[2].texto).toBe('Refeitos 3 estados a partir dos eventos')
  })
  test('singular', () => {
    const p = passosDaReconstrucao(rel({ leiloes: 1, chavesApagadas: 1, checkpointsApagados: 1, refeitos: 1 }))
    expect(p[0].texto).toBe('Fotografia: 1 leilão')
    expect(p[1].texto).toBe('Apagados: 1 chave do Redis e 1 checkpoint')
    expect(p[2].texto).toBe('Refeitos 1 estado a partir dos eventos')
  })
})
