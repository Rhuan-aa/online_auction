import { afterEach, expect, test, vi } from 'vitest'
import { carregarComparacoes } from './historico.ts'

afterEach(() => vi.unstubAllGlobals())

test('entrada antiga sem p99 volta com p99 null', () => {
  const antiga = { id: '1', escrita: { p50: 1, p95: 2 }, leitura: { p50: 1, p95: 2 } }
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify([{ id: 'c', execucoes: { A: antiga } }]) })
  const [c] = carregarComparacoes()
  const e = c.execucoes.A!
  expect(e.escrita.p99).toBeNull()
  expect(e.leitura.p99).toBeNull()
  expect(e.escrita.p95).toBe(2)
})
