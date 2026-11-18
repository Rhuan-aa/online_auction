import { expect, test } from 'vitest'
import { ABAS, hrefDe, lerRota } from './rota.ts'

test('aba e leilão da URL', () => expect(lerRota('#/auditoria?leilao=abc')).toEqual({ aba: 'auditoria', leilaoId: 'abc' }))
test('padrão é integridade sem leilão', () => expect(lerRota('')).toEqual({ aba: 'integridade', leilaoId: null }))
test('aba desconhecida cai no padrão', () => expect(lerRota('#/xyz').aba).toBe('integridade'))
test('ida e volta', () => expect(lerRota(hrefDe({ aba: 'rede', leilaoId: 'x' }))).toEqual({ aba: 'rede', leilaoId: 'x' }))
test('rota antiga #/leilao/{id} continua valendo', () =>
  expect(lerRota('#/leilao/abc')).toEqual({ aba: 'integridade', leilaoId: 'abc' }))
test('hrefDe sem leilão não leva query', () => expect(hrefDe({ aba: 'rede', leilaoId: null })).toBe('#/rede'))
test('seis abas com rótulo e pergunta', () => {
  expect(ABAS.map((a) => a.id)).toEqual(['integridade', 'desempenho', 'rede', 'auditoria', 'arquitetura', 'e-se-fosse'])
  expect(ABAS.every((a) => a.rotulo && a.pergunta)).toBe(true)
})
test('id malformado em #/leilao/ não quebra', () => {
  expect(lerRota('#/leilao/%')).toEqual({ aba: 'integridade', leilaoId: null })
  expect(lerRota('#/leilao/%E0%A4%A')).toEqual({ aba: 'integridade', leilaoId: null })
})
test('query malformada não quebra e mantém a aba', () => {
  expect(() => lerRota('#/rede?leilao=%')).not.toThrow()
  expect(lerRota('#/rede?leilao=%').aba).toBe('rede')
})
