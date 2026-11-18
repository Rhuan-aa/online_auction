import { expect, test } from 'vitest'
import { bytes, convertido, ms, pct, pctDesatualizadas, progresso, textoStatus } from './medidas.ts'
import type { ArqFoto } from './tipos.ts'

test('formatos com vírgula e traço sem dado', () => {
  expect(ms(4.25)).toBe('4,3 ms')
  expect(ms(null)).toBe('—')
  expect(ms(Number.NaN)).toBe('—')
  expect(pct(12.34)).toBe('12,3%')
  expect(bytes(49152)).toBe('48,0 KB')
  expect(bytes(3 * 1024 * 1024)).toBe('3,0 MB')
})
test('leituras desatualizadas vêm das contagens', () => {
  const leitura = { p50: 1, p95: 2, consultas: 200, desatualizadas: 50, pctDesatualizadas: 0, atrasoMedioVersoes: 0, atrasoMedioMs: 0 }
  expect(pctDesatualizadas({ leitura } as ArqFoto)).toBe(25)
  expect(pctDesatualizadas({ leitura: { ...leitura, consultas: 0, desatualizadas: 0 } } as ArqFoto)).toBeNull()
})
test('progresso entre 0 e 1', () => {
  expect(progresso({ enviados: 50, total: 200 })).toBe(0.25)
  expect(progresso({ enviados: 5, total: 0 })).toBe(0)
  expect(progresso({ enviados: 300, total: 200 })).toBe(1)
})
test('status', () => {
  expect(textoStatus({ status: 'rodando', terminouEmMs: null, erro: null })).toBe('rodando')
  expect(textoStatus({ status: 'terminou', terminouEmMs: 3400, erro: null })).toBe('terminou em 3.400,0 ms')
  expect(textoStatus({ status: 'parada', terminouEmMs: null, erro: null })).toBe('parada')
  expect(textoStatus({ status: 'erro', terminouEmMs: null, erro: 'Redis fora' })).toBe('erro: Redis fora')
})

test('tempo em ms convertido para s ou min ao passar o mouse', () => {
  expect(convertido(27)).toBe('0,027 s (menos de 1 segundo)')
  expect(convertido(1368)).toBe('1,37 segundos')
  expect(convertido(59_999)).toBe('60,00 segundos')
  expect(convertido(123_400)).toBe('2 min 3,4 s (2,06 minutos)')
  expect(convertido(null)).toBeNull()
})
