import { expect, test, vi } from 'vitest'
import { ErroHttp, type Api, type ConfiguracaoCache } from '../../api.ts'
import { ErroSimulacao, type Execucao, type Parametros } from '../../simulacao.ts'
import { compararABC } from './comparacao.ts'

const P: Parametros = {
  licitantes: 2, lancesPorLicitante: 2, simultaneos: 2, precoInicial: 100, incrementoMin: 10,
  incrementoMax: 20, leitores: 1, semente: 1, acompanharPreco: true,
}

type Porta = 'escrita' | 'leitura'

interface Opcoes {
  escrita?: ConfiguracaoCache
  leitura?: ConfiguracaoCache
  /** Serviço que ignora a troca para esta configuração (o PUT não pega). */
  ignorarTrocaPara?: { leitura?: ConfiguracaoCache }
  /** Chamadas de troca (1-based, na ordem) que rejeitam sem mudar nada (ex.: 503 ao ir para C). */
  falharNaChamada?: number[]
}

function apiFalsa(o: Opcoes = {}) {
  const atual = { escrita: o.escrita ?? 'C', leitura: o.leitura ?? o.escrita ?? 'C' } as Record<Porta, ConfiguracaoCache>
  /** Cada PUT, como chegou: [serviço, configuração]. */
  const trocas: [Porta, ConfiguracaoCache][] = []
  const api = {
    lerConfiguracaoCache: async (s: Porta) => atual[s],
    trocarConfiguracaoCache: async (s: Porta, c: ConfiguracaoCache) => {
      trocas.push([s, c])
      if (o.falharNaChamada?.includes(trocas.length)) throw new ErroHttp(503, 'REDIS_INDISPONIVEL')
      if (s === 'leitura' && o.ignorarTrocaPara?.leitura === c) return atual[s]
      atual[s] = c
      return c
    },
  } as unknown as Api
  return { api, trocas, atual }
}

const execucaoDe = (configuracao: ConfiguracaoCache) => ({ id: configuracao, configuracao }) as unknown as Execucao
const rodar = async (_a: Api, _p: Parametros, cfg: ConfiguracaoCache) => execucaoDe(cfg)
const semAbortar = () => new AbortController().signal

test('roda A, B e C nessa ordem e restaura a anterior', async () => {
  const f = apiFalsa({ escrita: 'C' })
  const vistas: ConfiguracaoCache[] = []
  const c = await compararABC(f.api, P, () => {}, semAbortar(), async (_a, _p, cfg) => {
    vistas.push(cfg)
    return execucaoDe(cfg)
  })
  expect(Object.keys(c.execucoes)).toEqual(['A', 'B', 'C'])
  expect(vistas).toEqual(['A', 'B', 'C'])
  expect(c.completa).toBe(true)
  expect(c.restauracaoFalhou).toBeUndefined()
  expect(f.trocas).toEqual([
    ['escrita', 'A'], ['leitura', 'A'], ['escrita', 'B'], ['leitura', 'B'],
    ['escrita', 'C'], ['leitura', 'C'], ['escrita', 'C'], ['leitura', 'C'],
  ])
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
  expect(f.trocas).toEqual([['escrita', 'A'], ['leitura', 'A'], ['escrita', 'B'], ['leitura', 'B']])
  expect(f.atual).toEqual({ escrita: 'B', leitura: 'B' })
})

test('erro numa execução restaura e propaga', async () => {
  const f = apiFalsa({ escrita: 'A' })
  await expect(compararABC(f.api, P, () => {}, semAbortar(), async (_a, _p, cfg) => {
    if (cfg === 'B') throw new Error('falhou em B')
    return execucaoDe(cfg)
  })).rejects.toThrow('falhou em B')
  expect(f.trocas.slice(-2)).toEqual([['escrita', 'A'], ['leitura', 'A']])
  expect(f.atual).toEqual({ escrita: 'A', leitura: 'A' })
})

test('serviços discordando não roda nada', async () => {
  const f = apiFalsa({ escrita: 'C', leitura: 'B' })
  await expect(compararABC(f.api, P, () => {}, semAbortar(), rodar)).rejects.toThrow(ErroSimulacao)
  expect(f.trocas).toEqual([])
})

test('troca que não pega aborta e restaura as duas portas', async () => {
  const f = apiFalsa({ escrita: 'C', ignorarTrocaPara: { leitura: 'A' } })
  await expect(compararABC(f.api, P, () => {}, semAbortar(), rodar)).rejects.toThrow('Não foi possível trocar para A')
  expect(f.trocas.slice(-2)).toEqual([['escrita', 'C'], ['leitura', 'C']])
  expect(f.atual).toEqual({ escrita: 'C', leitura: 'C' })
})

test('avisa o progresso com a configuração da vez e as já feitas', async () => {
  const f = apiFalsa({ escrita: 'A' })
  const avisos: { configuracao: ConfiguracaoCache; feitas: ConfiguracaoCache[] }[] = []
  await compararABC(f.api, P, (a) => avisos.push({ configuracao: a.configuracao, feitas: a.feitas }), semAbortar(),
    async (_a, _p, cfg, aoProgredir) => {
      aoProgredir({ fase: 'x', enviados: 0, total: 1, aceitos: 0, recusados: 0, conflitos: 0, erros: 0, consultas: 0 })
      return execucaoDe(cfg)
    })
  expect(avisos).toEqual([
    { configuracao: 'A', feitas: [] }, { configuracao: 'B', feitas: ['A'] }, { configuracao: 'C', feitas: ['A', 'B'] },
  ])
})

test('503 na troca para C: rejeita e tenta restaurar nas duas portas', async () => {
  const f = apiFalsa({ escrita: 'A', falharNaChamada: [5] }) // 5ª chamada = escrita para C
  await expect(compararABC(f.api, P, () => {}, semAbortar(), rodar)).rejects.toThrow('REDIS_INDISPONIVEL')
  expect(f.trocas.slice(-2)).toEqual([['escrita', 'A'], ['leitura', 'A']])
  expect(f.atual).toEqual({ escrita: 'A', leitura: 'A' })
})

test('falha na restauração: o resultado segue, o erro só é logado e a outra porta é restaurada', async () => {
  const f = apiFalsa({ escrita: 'B', falharNaChamada: [7] }) // 7ª = restaurar a escrita
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  const c = await compararABC(f.api, P, () => {}, semAbortar(), rodar)
  expect(c.completa).toBe(true)
  expect(c.restauracaoFalhou).toBe(true)
  expect(f.trocas.at(-1)).toEqual(['leitura', 'B'])
  expect(f.atual.leitura).toBe('B')
  expect(log).toHaveBeenCalled()
  log.mockRestore()
})

test('falha na restauração depois de erro da execução propaga o erro original', async () => {
  const f = apiFalsa({ escrita: 'B', falharNaChamada: [3] }) // restaurar a escrita depois do erro em A
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  await expect(compararABC(f.api, P, () => {}, semAbortar(), async () => { throw new Error('original') }))
    .rejects.toThrow('original')
  expect(f.trocas.at(-1)).toEqual(['leitura', 'B'])
  log.mockRestore()
})

test('abortar antes da primeira troca: nada roda, volta vazia, só a restauração idempotente', async () => {
  const f = apiFalsa({ escrita: 'B' })
  const ctrl = new AbortController()
  ctrl.abort()
  const c = await compararABC(f.api, P, () => {}, ctrl.signal, async () => { throw new Error('não devia rodar') })
  expect(c.execucoes).toEqual({})
  expect(c.completa).toBe(false)
  expect(f.trocas).toEqual([['escrita', 'B'], ['leitura', 'B']])
})

test('abortar durante um fetch (erro qualquer) devolve o parcial e restaura', async () => {
  const f = apiFalsa({ escrita: 'C' })
  const ctrl = new AbortController()
  const c = await compararABC(f.api, P, () => {}, ctrl.signal, async (_a, _p, cfg) => {
    if (cfg === 'B') { ctrl.abort(); throw new TypeError('Failed to fetch') }
    return execucaoDe(cfg)
  })
  expect(Object.keys(c.execucoes)).toEqual(['A'])
  expect(c.completa).toBe(false)
  expect(f.trocas.slice(-2)).toEqual([['escrita', 'C'], ['leitura', 'C']])
})

test('abortar com um Error simples depois do sinal também devolve o parcial', async () => {
  const f = apiFalsa({ escrita: 'A' })
  const ctrl = new AbortController()
  const c = await compararABC(f.api, P, () => {}, ctrl.signal, async () => { ctrl.abort(); throw new Error('simples') })
  expect(c.execucoes).toEqual({})
  expect(c.completa).toBe(false)
})
