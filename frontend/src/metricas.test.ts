import { expect, test } from 'vitest'
import { ErroHttp, type Api, type Metrica } from './api.ts'
import { diferenca, fotografarServicos } from './metricas.ts'

function metrica(count: number, total: number): Metrica {
  return { name: 'm', measurements: [{ statistic: 'COUNT', value: count }, { statistic: 'TOTAL_TIME', value: total }], availableTags: [] }
}

function apiDeMetricas(responde: (nome: string, tags: string[]) => Metrica | number) {
  const chamadas: { servico: string; nome: string; tags: string[] }[] = []
  const api = {
    lerMetrica: async (servico: string, nome: string, tags: string[] = []) => {
      chamadas.push({ servico, nome, tags })
      const r = responde(nome, tags)
      if (typeof r === 'number') throw new ErroHttp(r, 'sem medidor')
      return r
    },
  } as unknown as Api
  return { api, chamadas }
}

test('pede as métricas com a tag configuracao:X', async () => {
  const { api, chamadas } = apiDeMetricas(() => metrica(1, 1))
  await fotografarServicos(api, 'B')
  expect(chamadas.length).toBe(10)
  expect(chamadas.every((c) => c.tags.includes('configuracao:B'))).toBe(true)
  expect(chamadas.some((c) => c.tags.includes('caminho:comando'))).toBe(true)
  expect(chamadas.some((c) => c.tags.includes('caminho:consulta'))).toBe(true)
})

test('404 (medidor ainda não registrado) vira zero e diferenca funciona', async () => {
  const { api } = apiDeMetricas((nome, tags) => nome === 'leilao.estado.eventos.lidos' && tags.includes('base:redis') ? 404 : metrica(4, 2))
  const antes = await fotografarServicos(api, 'A')
  expect(antes.escrita.bases.redis).toEqual({ count: 0, total: 0 })
  expect(antes.escrita.obter).toEqual({ count: 4, total: 2 })
  expect(diferenca(antes.escrita, antes.escrita).porBase.redis).toBe(0)
})

test('foto de configuração que nunca rodou: tudo zero', async () => {
  const { api } = apiDeMetricas(() => 404)
  const f = await fotografarServicos(api, 'C')
  expect(f.leitura.obter).toEqual({ count: 0, total: 0 })
})

test('outros erros continuam subindo', async () => {
  const { api } = apiDeMetricas(() => 500)
  await expect(fotografarServicos(api, 'A')).rejects.toThrow('sem medidor')
})
