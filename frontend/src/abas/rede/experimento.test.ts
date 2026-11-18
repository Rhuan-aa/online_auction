import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { EstadoComEvento, EstadoLeilao } from '../../api.ts'
import {
  atrasos, estadoDoExperimento, iniciarExperimento, registrarAceite, registrarVisto,
  type ApiExperimento, type Percepcao,
} from './experimento.ts'
import { criarThrottle } from './throttle.ts'

describe('percepção', () => {
  test('atraso só para lances desta janela', () => {
    const m = new Map<number, Percepcao>()
    registrarAceite(m, 7, 1000); registrarVisto(m, 7, 'sse', 1030); registrarVisto(m, 7, 'polling', 1600); registrarVisto(m, 8, 'sse', 2000)
    expect(atrasos(m)).toEqual({ sse: [30], polling: [600], naoMedidos: 1 })
  })
  test('segunda vez visto não altera', () => {
    const m = new Map<number, Percepcao>()
    registrarAceite(m, 7, 1000); registrarVisto(m, 7, 'sse', 1030); registrarVisto(m, 7, 'sse', 1500)
    expect(atrasos(m).sse).toEqual([30])
  })
  test('visto antes da resposta do POST dá atraso não negativo, pois o marco é o envio', () => {
    const m = new Map<number, Percepcao>()
    const envio = 1000 // a resposta do POST só chegaria em 1050
    registrarVisto(m, 7, 'sse', 1030); registrarAceite(m, 7, envio)
    expect(atrasos(m)).toEqual({ sse: [30], polling: [], naoMedidos: 0 })
  })
  test('atraso negativo (relógio estranho) sai das médias e conta como não medido', () => {
    const m = new Map<number, Percepcao>()
    registrarAceite(m, 7, 1000); registrarVisto(m, 7, 'sse', 990); registrarVisto(m, 7, 'polling', 1200)
    expect(atrasos(m)).toEqual({ sse: [], polling: [200], naoMedidos: 1 })
  })
})

describe('estadoDoExperimento', () => {
  const e = { leilaoId: 'a', versao: 1 } as EstadoLeilao
  test('só devolve o estado do leilão medido', () => {
    expect(estadoDoExperimento('a', e)).toBe(e)
    expect(estadoDoExperimento('b', e)).toBeNull()
    expect(estadoDoExperimento('a', null)).toBeNull()
  })
})

describe('iniciarExperimento', () => {
  const estado = (versao: number) => ({ leilaoId: 'a', versao }) as EstadoLeilao
  let emitir: (e: EstadoComEvento, bytes: number) => void
  let fechar: ReturnType<typeof vi.fn>
  let versoes: number[]
  let consultar: ReturnType<typeof vi.fn>
  let api: ApiExperimento

  beforeEach(() => {
    vi.useFakeTimers()
    fechar = vi.fn()
    versoes = [3]
    consultar = vi.fn(async () => estado(versoes[Math.min(consultar.mock.calls.length - 1, versoes.length - 1)]))
    api = {
      observarLeilao: (_id, aoMudar) => { emitir = aoMudar; return fechar as () => void },
      consultarLeilao: consultar as unknown as ApiExperimento['consultarLeilao'],
    }
  })
  afterEach(() => vi.useRealTimers())

  test('a primeira resposta de cada via é só a base; as seguintes contam', async () => {
    versoes = [3, 3, 4]
    const exp = iniciarExperimento(api, 'a', 1000, () => {})
    await vi.advanceTimersByTimeAsync(0)
    emitir(estado(3), 100)
    expect(exp.snapshot().percepcoes.size).toBe(0)

    emitir(estado(4), 50)
    expect(exp.snapshot().percepcoes.get(4)?.viaSse).not.toBeNull()
    await vi.advanceTimersByTimeAsync(1000) // polling ainda na versão 3
    expect(exp.snapshot().percepcoes.get(4)?.viaPolling).toBeNull()
    await vi.advanceTimersByTimeAsync(1000) // polling vê a 4
    expect(exp.snapshot().percepcoes.get(4)?.viaPolling).not.toBeNull()
    exp.parar()
  })

  test('contadores de SSE e polling são separados; SSE usa os bytes reais', async () => {
    const exp = iniciarExperimento(api, 'a', 1000, () => {})
    await vi.advanceTimersByTimeAsync(0)
    emitir(estado(3), 100); emitir(estado(4), 50)
    const s = exp.snapshot()
    expect(s.sse).toEqual({ requisicoes: 2, bytes: 150 })
    expect(s.polling.requisicoes).toBe(1)
    expect(s.polling.bytes).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(2000)
    expect(exp.snapshot().polling.requisicoes).toBe(3)
    expect(exp.snapshot().sse.requisicoes).toBe(2)
    exp.parar()
  })

  test('parar fecha o SSE, para o polling e congela resultados e callbacks', async () => {
    const aoMudar = vi.fn()
    const exp = iniciarExperimento(api, 'a', 1000, aoMudar)
    await vi.advanceTimersByTimeAsync(0)
    exp.parar()
    expect(fechar).toHaveBeenCalledTimes(1)

    const chamadas = consultar.mock.calls.length
    const antes = exp.snapshot()
    const avisos = aoMudar.mock.calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    emitir(estado(9), 10)
    exp.aceitou(9, 1)
    expect(consultar.mock.calls.length).toBe(chamadas)
    expect(aoMudar.mock.calls.length).toBe(avisos)
    expect(exp.snapshot()).toEqual(antes)
  })
})

describe('criarThrottle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  test('várias chamadas na janela viram uma; depois a janela reabre', () => {
    const fn = vi.fn()
    const t = criarThrottle(fn, 250)
    t.acionar(); t.acionar(); t.acionar()
    vi.advanceTimersByTime(249)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    t.acionar(); vi.advanceTimersByTime(250)
    expect(fn).toHaveBeenCalledTimes(2)
  })
  test('cancelar descarta a pendente', () => {
    const fn = vi.fn()
    const t = criarThrottle(fn, 250)
    t.acionar(); t.cancelar(); vi.advanceTimersByTime(1000)
    expect(fn).not.toHaveBeenCalled()
  })
})
