import { expect, test } from 'vitest'
import { ABAS } from '../../rota.ts'
import { ADRS } from './adrs.ts'
import { casarSse, luzDoCaminho, NOS, trechos, type Medicao } from './caminho.ts'
import { cartoesInfra, cartoesServicos } from './saude.ts'

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

test('cartões de serviço: UP, DOWN e sem resposta', () => {
  const c = cartoesServicos([
    { status: 'fulfilled', value: { status: 'UP', ms: 12.4 } },
    { status: 'fulfilled', value: { status: 'OUT_OF_SERVICE', ms: 5 } },
    { status: 'rejected', reason: new Error('x') },
  ])
  expect(c.map((x) => x.status)).toEqual(['UP', 'DOWN', 'DOWN'])
  expect(c[0].ms).toBe(12)
  expect(c[2]).toMatchObject({ ms: null, nota: 'sem resposta' })
})
test('cartões de infra: mapeia e, se falhar, avisa leitura fora', () => {
  const ok = cartoesInfra({ status: 'fulfilled', value: { postgres: { status: 'UP', ms: 3 }, redis: { status: 'DOWN', ms: 9, erro: 'x' }, kafka: { status: 'UP', ms: 20 } } })
  expect(ok.map((x) => x.status)).toEqual(['UP', 'DOWN', 'UP'])
  const falha = cartoesInfra({ status: 'rejected', reason: new Error('x') })
  expect(falha).toHaveLength(3)
  expect(falha.every((x) => x.status === 'DOWN' && x.nota === 'sem resposta (leitura fora)')).toBe(true)
})

test('ADRs levam a abas válidas', () => {
  expect(ADRS.map((a) => [a.id, a.aba])).toEqual([['ADR-001', 'rede'], ['ADR-002', 'auditoria'], ['ADR-003', 'desempenho'], ['ADR-004', 'arquitetura']])
  for (const a of ADRS) { expect(ABAS.some((b) => b.id === a.aba)).toBe(true); expect(a.decisao.length).toBeGreaterThan(20) }
})
