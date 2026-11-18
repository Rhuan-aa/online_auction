import { expect, test } from 'vitest'
import { checar, type LanceAceito } from './simulacao.ts'

const final = { liderId: 'licitante-1', precoAtual: 200 }
const historico = [{ versao: 2, licitanteId: 'licitante-1', valor: 200, criadoEm: '' }]
const aceitos: LanceAceito[] = [{ versao: 2, licitanteId: 'licitante-1', valor: 200 }]

test('checar leva a checagem de versões contíguas', () => {
  expect(checar(final, historico, aceitos, true).versoesContiguas).toBe(true)
  const c = checar(final, historico, aceitos, false)
  expect(c.versoesContiguas).toBe(false)
  expect(c.problemas.some((p) => p.includes('versões'))).toBe(true)
})
test('sem o 4º argumento, versões contíguas é verdadeiro (compatível)', () =>
  expect(checar(final, historico, aceitos).versoesContiguas).toBe(true))

// ---- executar com uma Api falsa
import type { Api, Metrica } from './api.ts'
import { executar, type Parametros } from './simulacao.ts'

const metricaVazia: Metrica = { name: 'm', measurements: [{ statistic: 'COUNT', value: 0 }, { statistic: 'TOTAL_TIME', value: 0 }], availableTags: [] }

function apiDeExecucao(eventos: Api['eventos']): Api {
  let versao = 1
  return {
    lerMetrica: async () => metricaVazia,
    criarLeilao: async () => ({ leilaoId: 'L1', versao: 1 }),
    consultarLeilao: async () => ({ status: 'ABERTO', versao, precoAtual: 100, liderId: null }),
    darLance: async () => ({ tipo: 'aceito', versao: ++versao, tentativas: 1 }),
    historicoLances: async () => [],
    eventos,
  } as unknown as Api
}

const PEQUENO: Parametros = {
  licitantes: 1, lancesPorLicitante: 1, simultaneos: 1, precoInicial: 100, incrementoMin: 10,
  incrementoMax: 10, leitores: 1, semente: 1, acompanharPreco: true,
}

test('falha ao ler os eventos não descarta a execução', async () => {
  const e = await executar(apiDeExecucao(async () => { throw new Error('boom') }), PEQUENO, 'B', () => {}, new AbortController().signal)
  expect(e.configuracao).toBe('B')
  expect(e.integridade.checagens.versoesContiguas).toBe(false)
  expect(e.integridade.checagens.problemas).toContain('não foi possível ler os eventos')
  expect(e.escrita.p99).not.toBeUndefined()
  expect(e.leitura.p99).not.toBeUndefined()
}, 15_000)
