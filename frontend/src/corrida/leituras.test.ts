import { expect, test } from 'vitest'
import { arq } from './fixtures.ts'
import { leituraConsulta, leituraCurva, leituraDesatualizadas, leituraEscrita, leituraEspaco, leituraOperacoes, leituraVazao, ranking } from './leituras.ts'

const crud = arq('crud', { nome: 'CRUD simples', escrita: { p50: 60, p95: 200, amostras: 10 }, lancesPorSegundo: 20 })
const cache = arq('es-cache', { nome: 'ES + cache', escrita: { p50: 20, p95: 50, amostras: 10 }, lancesPorSegundo: 300 })

test('ranking ignora quem não tem medida e ordena pelo sentido', () => {
  const sem = arq('es', { escrita: { p50: 1, p95: 1, amostras: 0 } })
  expect(ranking([crud, cache, sem], (a) => (a.escrita.amostras ? a.escrita.p50 : null), 'menor').map((i) => i.id)).toEqual(['es-cache', 'crud'])
})
test('escrita: diz quem é mais rápido e quantas vezes mais lento é o último', () => {
  const f = leituraEscrita([crud, cache])
  expect(f[0]).toBe('ES + cache registra lances mais rápido: 20,0 ms no caso típico.')
  expect(f[1]).toContain('CRUD simples é o mais lento para registrar: 60,0 ms, 3,0×')
  expect(f[2]).toContain('ES + cache segura melhor (50,0 ms)')
})
test('quando a diferença é pequena, não inventa vencedor', () => {
  const a = arq('crud', { nome: 'A', escrita: { p50: 10, p95: 20, amostras: 1 } })
  const b = arq('es', { nome: 'B', escrita: { p50: 10.5, p95: 20, amostras: 1 } })
  expect(leituraEscrita([a, b])[0]).toContain('parecidas. Diferença de só 5%')
})
test('vazão traduz para o intervalo em ms', () => {
  expect(leituraVazao([crud, cache])[0]).toBe('ES + cache deu conta de mais lances por segundo: 300,0 lances/s (1 lance a cada 3,3 ms).')
})
test('consulta e operações com menos de duas medidas ficam vazias', () => {
  expect(leituraConsulta([crud])).toEqual([])
  expect(leituraOperacoes([])).toEqual([])
})
test('desatualizadas explica CRUD e CQRS de forma diferente', () => {
  const l = (consultas: number, desatualizadas: number, atrasoMedioMs = 0) => ({ ...crud.leitura, consultas, desatualizadas, atrasoMedioMs })
  const f = leituraDesatualizadas([
    arq('crud', { nome: 'CRUD simples', leitura: l(100, 10) }),
    arq('es-cqrs', { nome: 'ES + CQRS', leitura: l(100, 40, 95) }),
    arq('es', { nome: 'ES', leitura: l(100, 0) }),
  ])
  expect(f[0]).toContain('ES + CQRS: 40,0% das consultas viram um preço velho (atraso médio de 95,0 ms)')
  expect(f[1]).toContain('Não é atraso: um UPDATE sobrescreveu outro')
  expect(f[2]).toBe('ES leu sempre o preço atual (0%).')
})
test('espaço cita quem guarda o histórico', () => {
  const f = leituraEspaco([
    arq('crud', { nome: 'CRUD', espaco: { linhas: 1, eventos: 0, chavesRedis: 0, bytes: 8192 } }),
    arq('es', { nome: 'ES', espaco: { linhas: 0, eventos: 90, chavesRedis: 0, bytes: 65536 } }),
  ])
  expect(f[0]).toBe('CRUD ocupou menos espaço (8,0 KB); ES ocupou mais (64,0 KB).')
  expect(f[1]).toContain('ES guarda cada evento')
})
test('curva aponta quem ficou mais lento e quem ficou estável', () => {
  const f = leituraCurva([
    arq('es', { nome: 'ES', curva: [{ versao: 10, ms: 10 }, { versao: 50, ms: 25 }] }),
    arq('es-cache', { nome: 'ES + cache', curva: [{ versao: 10, ms: 10 }, { versao: 50, ms: 10.5 }] }),
  ])
  expect(f[0]).toContain('ES ficou 150% mais lento')
  expect(f[0]).toContain('relê todos os eventos')
  expect(f[1]).toBe('ES + cache foi o mais estável (variação de 5%).')
  expect(leituraCurva([arq('es')])[0]).toContain('Poucos pontos')
})
