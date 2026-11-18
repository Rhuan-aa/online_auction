import { describe, expect, test } from 'vitest'
import { atrasos, registrarAceite, registrarVisto, type Percepcao } from './experimento.ts'
import { layoutWaterfall } from './waterfall.ts'
import type { Registro } from '../../rede.ts'

describe('experimento', () => {
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
  test('visto antes do aceite chegar também conta', () => {
    const m = new Map<number, Percepcao>()
    registrarVisto(m, 7, 'sse', 1030); registrarAceite(m, 7, 1040)
    expect(atrasos(m).sse).toEqual([-10])
  })
})

const reg = (id: number, quando: number, ms: number, status = 200, tipo: Registro['tipo'] = 'http'): Registro =>
  ({ id, quando, metodo: tipo === 'sse' ? 'SSE' : 'GET', rota: '/x', status, ms, bytes: 1, tipo })

describe('layoutWaterfall', () => {
  test('eixo vai do primeiro início ao último fim e posições são proporcionais', () => {
    const l = layoutWaterfall([reg(1, 1000, 100), reg(2, 1100, 300)])
    expect(l.duracao).toBe(400)
    expect(l.linhas[0]).toMatchObject({ inicio: 0, largura: 0.25, cor: 'var(--sucesso)', ponto: false })
    expect(l.linhas[1]).toMatchObject({ inicio: 0.25, largura: 0.75 })
  })
  test('status define a cor; SSE vira ponto', () => {
    const l = layoutWaterfall([reg(1, 0, 10, 404), reg(2, 0, 10, 500), reg(3, 0, 10, 0), reg(4, 5, 0, 200, 'sse')])
    expect(l.linhas.map((x) => x.cor)).toEqual(['var(--aviso)', 'var(--perigo)', 'var(--perigo)', 'var(--sucesso)'])
    expect(l.linhas[3].ponto).toBe(true)
  })
  test('só os últimos 30; vazio não quebra', () => {
    const rs = Array.from({ length: 40 }, (_, i) => reg(i, i * 10, 5))
    expect(layoutWaterfall(rs).linhas).toHaveLength(30)
    expect(layoutWaterfall([])).toEqual({ duracao: 0, linhas: [] })
  })
})
