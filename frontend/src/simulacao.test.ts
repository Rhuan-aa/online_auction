import { expect, test } from 'vitest'
import { checar, type LanceAceito } from './simulacao.ts'

const final = { liderId: 'licitante-1', precoAtual: 200 }
const historico = [{ versao: 2, licitanteId: 'licitante-1', valor: 200, criadoEm: '' }]
const aceitos: LanceAceito[] = [{ versao: 2, licitanteId: 'licitante-1', valor: 200 }]

test('checar leva a checagem de versões contíguas', () => {
  expect(checar(final, historico, aceitos, true).versoesContiguas).toBe(true)
  const c = checar(final, historico, aceitos, false)
  expect(c.versoesContiguas).toBe(false)
  expect(c.problemas.some((p) => p.includes('versões'))).toBe(true)
})
test('sem o 4º argumento, versões contíguas é verdadeiro (compatível)', () =>
  expect(checar(final, historico, aceitos).versoesContiguas).toBe(true))
