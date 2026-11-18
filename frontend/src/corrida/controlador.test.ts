import { describe, expect, test, vi } from 'vitest'
import { ErroHttp, FORA_DO_AR } from '../api.ts'
import { ControladorCorrida, type ApiCorrida } from './controlador.ts'
import type { Foto, Parametros } from './tipos.ts'

const P: Parametros = { licitantes: 5, lancesPorLicitante: 5, simultaneos: 2, leitores: 1, precoInicial: 10000, incremento: 100 }
const foto = (corridaId: string, rodando: boolean, decorridoMs = 1): Foto => ({ corridaId, parametros: P, decorridoMs, rodando, arquiteturas: [] })

type Ouvintes = Parameters<ApiCorrida['observarCorrida']>[1]

/** Api falsa: guarda os ouvintes de cada stream para o teste disparar eventos à mão. */
function falsa(sobrepor: Partial<ApiCorrida> = {}) {
  const streams = new Map<string, { ouvintes: Ouvintes; fechado: boolean }>()
  const api: ApiCorrida = {
    iniciarCorrida: vi.fn().mockResolvedValue({ corridaId: 'c1' }),
    pararCorrida: vi.fn().mockResolvedValue(undefined),
    consultarCorrida: vi.fn().mockResolvedValue(foto('c1', true)),
    observarCorrida: vi.fn((id: string, ouvintes: Ouvintes) => {
      const s = { ouvintes, fechado: false }
      streams.set(id, s)
      return () => { s.fechado = true }
    }),
    ...sobrepor,
  }
  const c = new ControladorCorrida(api)
  return { api, c, streams, s: () => c.estadoAtual() }
}

describe('ControladorCorrida', () => {
  test('inicia, recebe fotos e termina no `fim`', async () => {
    const { c, streams, s } = falsa()
    await c.iniciar(P)
    expect(s().fase).toBe('rodando')
    streams.get('c1')!.ouvintes.aoFoto(foto('c1', true, 250))
    expect(s().foto?.decorridoMs).toBe(250)
    streams.get('c1')!.ouvintes.aoFim(foto('c1', false, 900))
    expect(s().fase).toBe('terminou')
    expect(s().foto?.rodando).toBe(false)
    expect(streams.get('c1')!.fechado).toBe(true)
  })

  test('eventos de uma corrida antiga são ignorados', async () => {
    const { api, c, streams, s } = falsa()
    await c.iniciar(P)
    const velho = streams.get('c1')!
    ;(api.iniciarCorrida as ReturnType<typeof vi.fn>).mockResolvedValue({ corridaId: 'c2' })
    await c.iniciar(P)
    expect(velho.fechado).toBe(true)
    velho.ouvintes.aoFoto(foto('c1', true, 111))
    velho.ouvintes.aoFim(foto('c1', false, 999))
    velho.ouvintes.aoFalhar(true)
    expect(s().foto).toBeNull()
    expect(s().fase).toBe('rodando')
    expect(s().erro).toBeNull()
    streams.get('c2')!.ouvintes.aoFoto(foto('c2', true, 5))
    expect(s().foto?.corridaId).toBe('c2')
  })

  test('se o `fim` se perde, a consulta (GET) recupera o resultado', async () => {
    const final = foto('c1', false, 800)
    const { c, streams, s } = falsa({ consultarCorrida: vi.fn().mockResolvedValue(final) })
    await c.iniciar(P)
    streams.get('c1')!.ouvintes.aoFalhar(false) // o navegador ainda tenta reconectar
    expect(s().aviso).toMatch(/instável/)
    await vi.waitFor(() => expect(s().fase).toBe('terminou'))
    expect(s().foto).toEqual(final)
    expect(s().aviso).toBeNull()
  })

  test('se a corrida ainda roda, a consulta não encerra', async () => {
    const { c, streams, s } = falsa()
    await c.iniciar(P)
    streams.get('c1')!.ouvintes.aoFalhar(false)
    await Promise.resolve()
    await Promise.resolve()
    expect(s().fase).toBe('rodando')
  })

  test('stream fechado pelo navegador: ociosa, com a mensagem certa conforme houve foto ou não', async () => {
    const { c, streams, s } = falsa()
    await c.iniciar(P)
    streams.get('c1')!.ouvintes.aoFalhar(true)
    expect(s().fase).toBe('ociosa')
    expect(s().erro).toBe(FORA_DO_AR)
    await c.iniciar(P)
    streams.get('c1')!.ouvintes.aoFoto(foto('c1', true))
    streams.get('c1')!.ouvintes.aoFalhar(true)
    expect(s().erro).toMatch(/caiu antes do fim/)
  })

  test('parar: vai para "parando" e o `fim` chega pelo stream', async () => {
    const { api, c, streams, s } = falsa()
    await c.iniciar(P)
    await c.parar()
    expect(api.pararCorrida).toHaveBeenCalledWith('c1')
    expect(s().fase).toBe('parando')
    streams.get('c1')!.ouvintes.aoFoto(foto('c1', true)) // foto durante o parar não volta para "rodando"
    expect(s().fase).toBe('parando')
    streams.get('c1')!.ouvintes.aoFim(foto('c1', false))
    expect(s().fase).toBe('terminou')
  })

  test('parar com erro do servidor: volta a rodando e mostra o erro', async () => {
    const { c, s } = falsa({ pararCorrida: vi.fn().mockRejectedValue(new ErroHttp(500, 'quebrou')) })
    await c.iniciar(P)
    await c.parar()
    expect(s().fase).toBe('rodando')
    expect(s().erro).toMatch(/500.*quebrou/)
  })

  test('parar com a corrida sumida (404) ou serviço fora (0): fecha o stream e fica ociosa', async () => {
    for (const status of [404, 0]) {
      const { c, streams, s } = falsa({ pararCorrida: vi.fn().mockRejectedValue(new ErroHttp(status, 'x')) })
      await c.iniciar(P)
      await c.parar()
      expect(s().fase).toBe('ociosa')
      expect(streams.get('c1')!.fechado).toBe(true)
    }
  })

  test('parar sem corrida não faz nada', async () => {
    const { api, c, s } = falsa()
    await c.parar()
    expect(api.pararCorrida).not.toHaveBeenCalled()
    expect(s().fase).toBe('ociosa')
  })

  test('400: mostra o erro e fica ociosa, sem corrida em andamento', async () => {
    const { c, s } = falsa({ iniciarCorrida: vi.fn().mockRejectedValue(new ErroHttp(400, 'Threads demais', 'PARAMETRO_INVALIDO')) })
    await c.iniciar(P)
    expect(s().fase).toBe('ociosa')
    expect(s().erro).toMatch(/Threads demais/)
    expect(s().emAndamento).toBeNull()
  })

  describe('409 com corridaId', () => {
    const conflito = () => ({ iniciarCorrida: vi.fn().mockRejectedValue(new ErroHttp(409, 'ocupado', 'CORRIDA_EM_ANDAMENTO', 'velha')) })

    test('guarda o id e oferece acompanhar', async () => {
      const { c, streams, s } = falsa(conflito())
      await c.iniciar(P)
      expect(s().fase).toBe('ociosa')
      expect(s().emAndamento).toBe('velha')
      expect(s().erro).toMatch(/Já existe uma corrida em andamento/)
      c.acompanhar()
      expect(s().fase).toBe('rodando')
      expect(s().emAndamento).toBeNull()
      expect(s().erro).toBeNull()
      streams.get('velha')!.ouvintes.aoFoto(foto('velha', true, 40))
      expect(s().foto?.corridaId).toBe('velha')
      streams.get('velha')!.ouvintes.aoFim(foto('velha', false))
      expect(s().fase).toBe('terminou')
    })

    test('pararEmAndamento: acompanha e para a corrida antiga', async () => {
      const { api, c, s } = falsa(conflito())
      await c.iniciar(P)
      await c.pararEmAndamento()
      expect(api.pararCorrida).toHaveBeenCalledWith('velha')
      expect(s().fase).toBe('parando')
    })

    test('409 sem corridaId (serviço antigo): só a mensagem', async () => {
      const { c, s } = falsa({ iniciarCorrida: vi.fn().mockRejectedValue(new ErroHttp(409, 'ocupado')) })
      await c.iniciar(P)
      expect(s().emAndamento).toBeNull()
      c.acompanhar()
      expect(s().fase).toBe('ociosa')
    })
  })

  test('descartar fecha o stream e ignora o que vier depois', async () => {
    const { c, streams, s } = falsa()
    await c.iniciar(P)
    c.descartar()
    expect(streams.get('c1')!.fechado).toBe(true)
    streams.get('c1')!.ouvintes.aoFoto(foto('c1', true))
    expect(s().foto).toBeNull()
  })

  test('avisa os assinantes a cada mudança', async () => {
    const { c } = falsa()
    const ouvinte = vi.fn()
    const sair = c.assinar(ouvinte)
    await c.iniciar(P)
    expect(ouvinte).toHaveBeenCalled()
    sair()
    ouvinte.mockClear()
    c.descartar()
    expect(ouvinte).not.toHaveBeenCalled()
  })
})
