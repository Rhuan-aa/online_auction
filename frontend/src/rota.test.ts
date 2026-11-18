import { expect, test } from 'vitest'
import { ABAS, anterior, hrefDe, lerRota, proximo, temAnterior, temProximo, type Rota } from './rota.ts'
import { kickerDe, passosVisiveis, SECOES } from './secoes.ts'

test('aba e leilão da URL', () => expect(lerRota('#/auditoria?leilao=abc')).toEqual({ aba: 'auditoria', passo: 1, leilaoId: 'abc' }))
test('padrão é integridade, passo 1, sem leilão', () => expect(lerRota('')).toEqual({ aba: 'integridade', passo: 1, leilaoId: null }))
test('aba desconhecida cai no padrão', () => expect(lerRota('#/xyz').aba).toBe('integridade'))
test('ida e volta', () => expect(lerRota(hrefDe({ aba: 'rede', leilaoId: 'x' }))).toEqual({ aba: 'rede', passo: 1, leilaoId: 'x' }))
test('rota antiga #/leilao/{id} continua valendo', () =>
  expect(lerRota('#/leilao/abc')).toEqual({ aba: 'integridade', passo: 1, leilaoId: 'abc' }))
test('hrefDe sem leilão não leva query', () => expect(hrefDe({ aba: 'rede', leilaoId: null })).toBe('#/rede'))
test('seis abas com rótulo e pergunta', () => {
  expect(ABAS.map((a) => a.id)).toEqual(['integridade', 'desempenho', 'rede', 'auditoria', 'arquitetura', 'e-se-fosse'])
  expect(ABAS.every((a) => a.rotulo && a.pergunta)).toBe(true)
})
test('id malformado em #/leilao/ não quebra', () => {
  expect(lerRota('#/leilao/%')).toEqual({ aba: 'integridade', passo: 1, leilaoId: null })
  expect(lerRota('#/leilao/%E0%A4%A')).toEqual({ aba: 'integridade', passo: 1, leilaoId: null })
})
test('query malformada não quebra e mantém a aba', () => {
  expect(() => lerRota('#/rede?leilao=%')).not.toThrow()
  expect(lerRota('#/rede?leilao=%').aba).toBe('rede')
})

// passos
test('lê o passo do caminho', () => expect(lerRota('#/integridade/2?leilao=abc')).toEqual({ aba: 'integridade', passo: 2, leilaoId: 'abc' }))
test('passo inválido cai no 1', () => {
  for (const p of ['0', '-1', 'abc', '1.5', '99', '']) expect(lerRota(`#/integridade/${p}`).passo).toBe(1)
})
test('seção ainda não convertida só tem o passo 1', () => expect(lerRota('#/arquitetura/2').passo).toBe(1))
test('passo entra no href só quando passa de 1', () => {
  expect(hrefDe({ aba: 'integridade', passo: 1, leilaoId: null })).toBe('#/integridade')
  expect(hrefDe({ aba: 'integridade', passo: 3, leilaoId: 'a b' })).toBe('#/integridade/3?leilao=a%20b')
})
test('ida e volta com passo', () => {
  const r: Rota = { aba: 'integridade', passo: 3, leilaoId: 'x/y' }
  expect(lerRota(hrefDe(r))).toEqual(r)
})

// próximo / anterior
const em = (aba: Rota['aba'], passo: number): Rota => ({ aba, passo, leilaoId: 'L' })
test('próximo e anterior dentro da seção', () => {
  expect(proximo(em('integridade', 1))).toEqual(em('integridade', 2))
  expect(anterior(em('integridade', 3))).toEqual(em('integridade', 2))
})
test('próximo no último passo vai para o passo 1 da próxima seção', () =>
  expect(proximo(em('integridade', passosVisiveis('integridade')))).toEqual(em('desempenho', 1)))
test('anterior no primeiro passo vai para o último passo da seção anterior', () => {
  expect(anterior(em('desempenho', 1))).toEqual(em('integridade', passosVisiveis('integridade')))
  expect(anterior(em('rede', 1))).toEqual(em('desempenho', passosVisiveis('desempenho')))
})
test('para nas pontas', () => {
  expect(anterior(em('integridade', 1))).toEqual(em('integridade', 1))
  const ultima = SECOES[SECOES.length - 1].id
  expect(proximo(em(ultima, passosVisiveis(ultima)))).toEqual(em(ultima, passosVisiveis(ultima)))
})
test('temProximo / temAnterior: falsos só nas pontas', () => {
  const ultima = SECOES[SECOES.length - 1].id
  expect(temAnterior(em('integridade', 1))).toBe(false)
  expect(temProximo(em('integridade', 1))).toBe(true)
  expect(temAnterior(em('integridade', 2))).toBe(true)
  expect(temAnterior(em('desempenho', 1))).toBe(true)
  expect(temProximo(em('integridade', passosVisiveis('integridade')))).toBe(true)
  expect(temProximo(em(ultima, passosVisiveis(ultima)))).toBe(false)
  expect(temAnterior(em(ultima, passosVisiveis(ultima)))).toBe(true)
})
test('percorrer tudo com próximo e voltar com anterior passa por todos os slides', () => {
  const total = SECOES.reduce((n, s) => n + passosVisiveis(s.id), 0)
  let r = em('integridade', 1)
  for (let i = 1; i < total; i++) r = proximo(r)
  expect(r).toEqual(em('e-se-fosse', passosVisiveis('e-se-fosse')))
  for (let i = 1; i < total; i++) r = anterior(r)
  expect(r).toEqual(em('integridade', 1))
})
test('kicker com número da pergunta, passo e título do passo', () => {
  expect(kickerDe('integridade', 2)).toBe('Pergunta 1 · passo 2/3 · Simulação completa')
  expect(kickerDe('arquitetura', 1)).toBe('Pergunta 5 · passo 1/1')
})
