import { afterEach, beforeEach, expect, test } from 'vitest'
import { assinar, limpar, normalizarRota, registrar, registros, resumoPorRota } from './rede.ts'

const base = { quando: 0, metodo: 'GET', status: 200, ms: 10, tipo: 'http' as const }

beforeEach(() => limpar())
afterEach(() => limpar())

test('normaliza ids e tira origem e query', () => {
  expect(normalizarRota('http://localhost:8082/leiloes/6e643478-3fc4-43a1-93b4-88192839b48a/lances')).toBe('/leiloes/{id}/lances')
  expect(normalizarRota('http://localhost:8082/leiloes/6e643478-3fc4-43a1-93b4-88192839b48a?ateVersao=3')).toBe('/leiloes/{id}')
})

test('resumo soma por rota e ordena por bytes', () => {
  const rs = [
    { ...base, id: 1, rota: '/a', bytes: 10, ms: 10 },
    { ...base, id: 2, rota: '/a', bytes: 20, ms: 20 },
    { ...base, id: 3, rota: '/b', bytes: 100, ms: 5 },
  ]
  expect(resumoPorRota(rs)).toEqual([
    { rota: 'GET /b', requisicoes: 1, bytes: 100, msMedio: 5 },
    { rota: 'GET /a', requisicoes: 2, bytes: 30, msMedio: 15 },
  ])
})

test('registros guarda só os últimos 500 e assinar notifica e cancela', () => {
  const vistos: number[] = []
  const parar = assinar((r) => vistos.push(r.id))
  for (let i = 0; i < 502; i++) registrar({ ...base, rota: '/x', bytes: i })
  parar()
  registrar({ ...base, rota: '/x', bytes: 0 })
  expect(registros()).toHaveLength(500)
  expect(vistos).toHaveLength(502)
})
