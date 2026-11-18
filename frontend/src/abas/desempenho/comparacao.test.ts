import { expect, test } from 'vitest'
import type { Api, ConfiguracaoCache } from '../../api.ts'
import { ErroSimulacao, type Execucao, type Parametros } from '../../simulacao.ts'
import { compararABC } from './comparacao.ts'

const P: Parametros = {
  licitantes: 2, lancesPorLicitante: 2, simultaneos: 2, precoInicial: 100, incrementoMin: 10,
  incrementoMax: 20, leitores: 1, semente: 1, acompanharPreco: true,
}

interface Opcoes {
  escrita?: ConfiguracaoCache
  leitura?: ConfiguracaoCache
  /** Serviço que ignora a troca para esta configuração (o PUT não pega). */
  ignorarTrocaPara?: { leitura?: ConfiguracaoCache }
}

function apiFalsa(o: Opcoes = {}) {
  const atual = { escrita: o.escrita ?? 'C', leitura: o.leitura ?? o.escrita ?? 'C' } as Record<'escrita' | 'leitura', ConfiguracaoCache>
  const trocas: [ConfiguracaoCache, ConfiguracaoCache][] = []
  let pendente: Partial<Record<'escrita' | 'leitura', ConfiguracaoCache>> = {}
  const api = {
    lerConfiguracaoCache: async (s: 'escrita' | 'leitura') => atual[s],
    trocarConfiguracaoCache: async (s: 'escrita' | 'leitura', c: ConfiguracaoCache) => {
      if (s === 'leitura' && o.ignorarTrocaPara?.leitura === c) return atual[s]
      atual[s] = c
      pendente[s] = c
      if (pendente.escrita && pendente.leitura) { // uma troca = as duas portas
        trocas.push([pendente.escrita, pendente.leitura])
        pendente = {}
      }
      return c
    },
  } as unknown as Api
  return { api, trocas, atual }
}

const execucaoDe = (configuracao: ConfiguracaoCache) => ({ id: configuracao, configuracao }) as unknown as Execucao

test('roda A, B e C nessa ordem e restaura a anterior', async () => {
  const f = apiFalsa({ escrita: 'C' })
  const vistas: ConfiguracaoCache[] = []
  const c = await compararABC(f.api, P, () => {}, new AbortController().signal, async (_a, _p, cfg) => {
    vistas.push(cfg)
    return execucaoDe(cfg)
  })
  expect(Object.keys(c.execucoes)).toEqual(['A', 'B', 'C'])
  expect(vistas).toEqual(['A', 'B', 'C'])
  expect(c.completa).toBe(true)
  expect(f.trocas).toEqual([['A', 'A'], ['B', 'B'], ['C', 'C'], ['C', 'C']])
})

test('abortar no meio restaura a configuração anterior', async () => {
  const f = apiFalsa({ escrita: 'B' })
  const ctrl = new AbortController()
  const c = await compararABC(f.api, P, () => {}, ctrl.signal, async (_a, _p, cfg) => {
    ctrl.abort()
    return execucaoDe(cfg)
  })
  expect(Object.keys(c.execucoes)).toEqual(['A'])
  expect(c.completa).toBe(false)
  expect(f.trocas).toEqual([['A', 'A'], ['B', 'B']])
  expect(f.atual).toEqual({ escrita: 'B', leitura: 'B' })
})

test('erro numa execução restaura e propaga', async () => {
  const f = apiFalsa({ escrita: 'A' })
  await expect(compararABC(f.api, P, () => {}, new AbortController().signal, async (_a, _p, cfg) => {
    if (cfg === 'B') throw new Error('falhou em B')
    return execucaoDe(cfg)
  })).rejects.toThrow('falhou em B')
  expect(f.trocas.at(-1)).toEqual(['A', 'A'])
  expect(f.atual).toEqual({ escrita: 'A', leitura: 'A' })
})

test('serviços discordando não roda nada', async () => {
  const f = apiFalsa({ escrita: 'C', leitura: 'B' })
  await expect(compararABC(f.api, P, () => {}, new AbortController().signal, async (_a, _p, cfg) => execucaoDe(cfg)))
    .rejects.toThrow(ErroSimulacao)
  expect(f.trocas).toEqual([])
})

test('troca que não pega aborta e restaura', async () => {
  const f = apiFalsa({ escrita: 'C', ignorarTrocaPara: { leitura: 'A' } })
  await expect(compararABC(f.api, P, () => {}, new AbortController().signal, async (_a, _p, cfg) => execucaoDe(cfg)))
    .rejects.toThrow('Não foi possível trocar para A')
  expect(f.atual.escrita).toBe('C')
})

test('avisa o progresso com a configuração da vez e as já feitas', async () => {
  const f = apiFalsa({ escrita: 'A' })
  const avisos: { configuracao: ConfiguracaoCache; feitas: ConfiguracaoCache[] }[] = []
  await compararABC(f.api, P, (a) => avisos.push({ configuracao: a.configuracao, feitas: a.feitas }), new AbortController().signal,
    async (_a, _p, cfg, aoProgredir) => {
      aoProgredir({ fase: 'x', enviados: 0, total: 1, aceitos: 0, recusados: 0, conflitos: 0, erros: 0, consultas: 0 })
      return execucaoDe(cfg)
    })
  expect(avisos).toEqual([
    { configuracao: 'A', feitas: [] }, { configuracao: 'B', feitas: ['A'] }, { configuracao: 'C', feitas: ['A', 'B'] },
  ])
})
