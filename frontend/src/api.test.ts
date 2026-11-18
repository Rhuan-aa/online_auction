import { afterEach, expect, test, vi } from 'vitest'
import { api } from './api.ts'

afterEach(() => vi.unstubAllGlobals())

test('darLance lê tentativas no 200, no 422 e no 409', async () => {
  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ versao: 5, tentativas: 2 }), { status: 200 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'X', mensagem: 'm', tentativas: 1 }), { status: 422 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ erro: 'CONFLITO_DE_VERSAO', mensagem: 'm', tentativas: 3 }), { status: 409 })))
  const req = { licitanteId: 'licitante-1', valor: 100 }
  expect(await api.darLance('id', req)).toEqual({ tipo: 'aceito', versao: 5, tentativas: 2 })
  expect(await api.darLance('id', req)).toEqual({ tipo: 'recusado', codigo: 'X', mensagem: 'm', tentativas: 1 })
  expect(await api.darLance('id', req)).toEqual({ tipo: 'conflito', tentativas: 3 })
})

test('darLance: fetch que falha vira erro com status 0', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new TypeError('falhou')))
  expect(await api.darLance('x', { licitanteId: 'l', valor: 1 })).toEqual({ tipo: 'erro', status: 0 })
})

test('estadoNaVersao usa ateVersao', async () => {
  const f = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', f)
  await api.estadoNaVersao('i', 3)
  expect(f.mock.calls[0][0]).toBe('http://localhost:8082/leiloes/i?ateVersao=3')
})

test('listarLeiloes filtra por status', async () => {
  const f = vi.fn().mockResolvedValueOnce(new Response('[]', { status: 200 }))
  vi.stubGlobal('fetch', f)
  expect(await api.listarLeiloes('ABERTO')).toEqual([])
  expect(f.mock.calls[0][0]).toBe('http://localhost:8082/leiloes?status=ABERTO')
})

test('criarLeilao: erro HTTP vira ErroHttp com a mensagem do corpo', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"erro":"E","mensagem":"ruim"}', { status: 400 })))
  await expect(api.criarLeilao({ vendedorId: 'v', titulo: 't', precoInicial: 1, incrementoMinimo: 1, inicioEm: 'a', fimEm: 'b' }))
    .rejects.toMatchObject({ status: 400, codigo: 'E', message: 'ruim' })
})
