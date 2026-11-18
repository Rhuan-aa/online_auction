import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { api } from './api.ts'
import { assinar, limpar, registros } from './rede.ts'

beforeEach(() => limpar())
afterEach(() => { vi.unstubAllGlobals(); limpar() })

test('darLance lê tentativas no 200 e no 422', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ versao: 5, tentativas: 2 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'X', mensagem: 'm', tentativas: 1 }), { status: 422 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'CONFLITO_DE_VERSAO', mensagem: 'm', tentativas: 3 }), { status: 409 })))
  const req = { licitanteId: 'licitante-1', valor: 100 }
  expect(await api.darLance('id', req)).toEqual({ tipo: 'aceito', versao: 5, tentativas: 2 })
  expect(await api.darLance('id', req)).toEqual({ tipo: 'recusado', codigo: 'X', mensagem: 'm', tentativas: 1 })
  expect(await api.darLance('id', req)).toEqual({ tipo: 'conflito', tentativas: 3 })
})

test('fetch que falha vira erro com status 0 e é registrado', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('falhou')))
  expect(await api.darLance('6e643478-3fc4-43a1-93b4-88192839b48a', { licitanteId: 'l', valor: 1 })).toEqual({ tipo: 'erro', status: 0 })
  const rs = registros()
  expect(rs).toHaveLength(1)
  expect(rs[0]).toMatchObject({ status: 0, bytes: 0, metodo: 'POST', rota: '/leiloes/{id}/lances', tipo: 'http' })
})

test('medidor conta os bytes do corpo', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"a":1}', { status: 200 })))
  const registrado = new Promise<void>((ok) => { const parar = assinar(() => { parar(); ok() }) })
  await api.historicoLances('6e643478-3fc4-43a1-93b4-88192839b48a')
  await registrado
  expect(registros()[0]).toMatchObject({ bytes: 7, status: 200, metodo: 'GET', rota: '/leiloes/{id}/lances' })
})

test('lerMetrica manda várias tags', async () => {
  const f = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', f)
  await api.lerMetrica('leitura', 'm', ['a:1', 'b:2'])
  expect(f.mock.calls[0][0]).toBe('http://localhost:8082/actuator/metrics/m?tag=a%3A1&tag=b%3A2')
})

test('trocarConfiguracaoCache faz PUT e devolve a configuração', async () => {
  const f = vi.fn().mockResolvedValueOnce(new Response('{"configuracao":"B"}', { status: 200 }))
  vi.stubGlobal('fetch', f)
  expect(await api.trocarConfiguracaoCache('escrita', 'B')).toBe('B')
  expect(f.mock.calls[0][0]).toBe('http://localhost:8081/admin/cache/configuracao')
  expect(f.mock.calls[0][1]).toMatchObject({ method: 'PUT', body: '{"configuracao":"B"}' })
})

test('estadoNaVersao usa ateVersao e saudeServico devolve status e ms', async () => {
  const f = vi.fn()
    .mockResolvedValueOnce(new Response('{}', { status: 200 }))
    .mockResolvedValueOnce(new Response('{"status":"UP"}', { status: 200 }))
  vi.stubGlobal('fetch', f)
  await api.estadoNaVersao('i', 3)
  expect(f.mock.calls[0][0]).toBe('http://localhost:8082/leiloes/i?ateVersao=3')
  const s = await api.saudeServico('agendador')
  expect(f.mock.calls[1][0]).toBe('http://localhost:8084/actuator/health')
  expect(s.status).toBe('UP')
  expect(typeof s.ms).toBe('number')
})

test('saudeServico: 503 com corpo DOWN não lança', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"status":"DOWN"}', { status: 503 })))
  expect((await api.saudeServico('leitura')).status).toBe('DOWN')
})

test('saudeServico: 200 UP', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"status":"UP"}', { status: 200 })))
  expect((await api.saudeServico('escrita')).status).toBe('UP')
})

test('saudeServico: falha de rede lança', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('falhou')))
  await expect(api.saudeServico('agendador')).rejects.toThrow()
})
