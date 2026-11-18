import { expect, test } from 'vitest'
import { casarSse, luzDoCaminho, NOS, trechos, type Medicao } from './caminho.ts'

const m9: Medicao = { versao: 9, cliqueEm: 0, respostaEm: 12, sseEm: null }

test('SSE completa a medição da mesma versão', () => expect(casarSse([m9], 9, 40)[0].sseEm).toBe(40))
test('trechos', () => expect(trechos({ versao: 9, cliqueEm: 0, respostaEm: 12, sseEm: 40 })).toEqual({ gravacaoMs: 12, propagacaoMs: 28 }))
test('SSE de outra versão não mexe', () => expect(casarSse([m9], 10, 50)[0].sseEm).toBeNull())
test('trechos sem resposta ou sem SSE ficam nulos', () => {
  expect(trechos({ ...m9, respostaEm: null })).toEqual({ gravacaoMs: null, propagacaoMs: null })
  expect(trechos(m9)).toEqual({ gravacaoMs: 12, propagacaoMs: null })
})
test('SSE não sobrescreve medição já completa', () => {
  expect(casarSse([{ ...m9, sseEm: 30 }], 9, 99)[0].sseEm).toBe(30)
})
test('NOS tem os sete nós', () => expect(NOS).toHaveLength(7))

test('luz: gravando acende só front→escrita→eventstore, em sequência', () => {
  const l = luzDoCaminho('gravando')
  expect(Object.keys(l).sort()).toEqual(['escrita', 'escrita>eventstore', 'eventstore', 'front', 'front>escrita'].sort())
  expect(l.front).toBeLessThan(l['front>escrita'])
  expect(l['escrita>eventstore']).toBeLessThan(l.eventstore)
})
test('luz: completo acende tudo, com o agendador como ramo', () => {
  const l = luzDoCaminho('completo')
  for (const n of NOS) expect(l[n]).toBeDefined()
  expect(l['kafka>agendador']).toBeDefined()
  expect(l['sse>front']).toBeGreaterThan(l['leitura>sse'])
})
test('luz: externo acende só kafka→leitura→sse→front', () => {
  const l = luzDoCaminho('externo')
  expect(Object.keys(l).sort()).toEqual(['front', 'kafka', 'kafka>leitura', 'leitura', 'leitura>sse', 'sse', 'sse>front'].sort())
})
test('luz: sem fase, nada aceso', () => expect(luzDoCaminho(null)).toEqual({}))

test('SSE antes da resposta do POST: propagação nula, não 0 ms', () => {
  expect(trechos({ versao: 9, cliqueEm: 0, respostaEm: 12, sseEm: 10 })).toEqual({ gravacaoMs: 12, propagacaoMs: null })
})
