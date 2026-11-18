import { expect, test } from 'vitest'
import type { EstadoLeilao, EventoGravado, ResultadoLance } from '../../api.ts'
import { agruparAceitos, planejarRajada, resumirRajada, versoesContiguas, type ResultadoRajada } from './rajada.ts'

const estado: EstadoLeilao = {
  leilaoId: 'x', titulo: 't', status: 'ABERTO', precoAtual: 1000, liderId: 'a', fimEm: '2099-01-01T00:00:00Z', versao: 3,
}
const ev = (versao: number): EventoGravado => ({ versao, tipo: 'LanceRegistrado.v1', dados: {}, criadoEm: '' })
const r = (resultado: ResultadoLance): ResultadoRajada => ({ pedido: { licitanteId: 'l', valor: 1 }, resultado, ms: 1 })
const aceito = (tentativas: number) => r({ tipo: 'aceito', versao: 4, tentativas })
const recusado = (tentativas: number) => r({ tipo: 'recusado', tentativas })

test('rajada com mesmo valor manda o mesmo valor para todos', () => {
  const p = planejarRajada(estado, 100, 4, true)
  expect(new Set(p.map((x) => x.valor)).size).toBe(1)
  expect(p).toHaveLength(4)
  expect(p[0].valor).toBe(1100)
})
test('valores diferentes somam i x incremento', () =>
  expect(planejarRajada(estado, 100, 3, false).map((x) => x.valor)).toEqual([1100, 1200, 1300]))
test('licitantes em rodízio de 1 a 3', () =>
  expect(planejarRajada(estado, 100, 5, true).map((x) => x.licitanteId))
    .toEqual(['licitante-1', 'licitante-2', 'licitante-3', 'licitante-1', 'licitante-2']))
test('n fora de 2..6 é limitado', () => {
  expect(planejarRajada(estado, 100, 50, true)).toHaveLength(6)
  expect(planejarRajada(estado, 100, 0, true)).toHaveLength(2)
})
test('colisões somam tentativas extras', () =>
  expect(resumirRajada([aceito(1), recusado(2), recusado(3)]).colisoes).toBe(3))
test('resumo conta cada tipo', () =>
  expect(resumirRajada([aceito(1), recusado(2), r({ tipo: 'conflito', tentativas: 3 }), r({ tipo: 'erro', status: 0 })]))
    .toEqual({ aceitos: 1, recusados: 1, conflitos: 1, colisoes: 3 }))
test('versões com buraco falham', () => expect(versoesContiguas([ev(1), ev(2), ev(4)])).toBe(false))
test('versões repetidas falham', () => expect(versoesContiguas([ev(1), ev(2), ev(2)])).toBe(false))
test('versões 1..n passam, mesmo fora de ordem', () => {
  expect(versoesContiguas([ev(2), ev(1), ev(3)])).toBe(true)
  expect(versoesContiguas([])).toBe(true)
})

test('três aceitos em versões diferentes viram três degraus, em ordem', () => {
  const a = (versao: number) => r({ tipo: 'aceito', versao, tentativas: versao })
  const grupos = agruparAceitos([a(6), recusado(1), a(4), a(5)])
  expect(grupos.map((g) => g.versao)).toEqual([4, 5, 6])
  expect(grupos.every((g) => g.resultados.length === 1)).toBe(true)
})
test('aceitos na mesma versão ficam juntos e os que não foram aceitos ficam de fora', () => {
  const a = (versao: number) => r({ tipo: 'aceito', versao, tentativas: 1 })
  const grupos = agruparAceitos([a(4), a(4), recusado(1)])
  expect(grupos).toHaveLength(1)
  expect(grupos[0].resultados).toHaveLength(2)
})
