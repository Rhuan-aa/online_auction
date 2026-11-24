import { expect, test } from 'vitest'
import { arq } from './fixtures.ts'
import { contagemDoEspaco, cores, desatualizadas, espaco, gruposTempos, lancesPorSegundo, seriesCurva } from './series.ts'

const crud = arq('crud', { escrita: { p50: 2, p95: 5, amostras: 10 } })
const es = arq('es', { escrita: { p50: 8, p95: 30, amostras: 0 }, leitura: { ...arq('es').leitura, consultas: 0 } })

test('sem foto, nenhum grupo nem série', () => {
  expect(gruposTempos([], 'escrita')).toEqual([])
  expect(lancesPorSegundo([])).toEqual([])
  expect(seriesCurva([])).toEqual([])
})
test('tempos: p50 e p95 agrupados, uma barra por arquitetura; sem amostra fica null', () => {
  expect(gruposTempos([crud, es], 'escrita')).toEqual([
    { rotulo: 'Típico (p50)', valores: [{ serie: 'CRUD', valor: 2 }, { serie: 'ES', valor: null }] },
    { rotulo: 'Pior caso (p95)', valores: [{ serie: 'CRUD', valor: 5 }, { serie: 'ES', valor: null }] },
  ])
  expect(gruposTempos([crud, es], 'leitura')[0].valores).toEqual([{ serie: 'CRUD', valor: 1 }, { serie: 'ES', valor: null }])
})
test('cor de cada série segue a ordem do contrato', () => {
  expect(cores([crud, es])).toEqual({ CRUD: 'var(--arq-1)', ES: 'var(--arq-3)' })
  expect(cores([arq('outra')]).OUTRA).toBe('var(--tinta-suave)')
})
test('lances por segundo: null antes do primeiro lance', () => {
  expect(lancesPorSegundo([crud, arq('es', { enviados: 0 })])[0].valores.map((v) => v.valor)).toEqual([50, null])
})
test('leituras desatualizadas em % das consultas', () => {
  const cqrs = arq('es-cqrs', { leitura: { ...crud.leitura, consultas: 200, desatualizadas: 30 } })
  expect(desatualizadas([cqrs])[0].valores[0].valor).toBe(15)
})
test('espaço só depois do fim, em KB', () => {
  expect(espaco([crud])).toEqual([])
  const fim = arq('es', { espaco: { linhas: 1, eventos: 81, chavesRedis: 0, bytes: 49152 } })
  expect(espaco([fim, crud])[0].valores).toEqual([{ serie: 'ES', valor: 48 }, { serie: 'CRUD', valor: null }])
})
test('curva: pontos ordenados por versão, com a cor da arquitetura', () => {
  const s = seriesCurva([arq('es-cache', { curva: [{ versao: 20, ms: 4.1 }, { versao: 10, ms: 3.9 }] })])
  expect(s).toEqual([{ nome: 'ES-CACHE', cor: 'var(--arq-4)', pontos: [{ x: 10, y: 3.9 }, { x: 20, y: 4.1 }] }])
})

test('contagem do espaço: linhas, eventos e chaves de quem tem resultado final', () => {
  const a = arq('crud', { nome: 'CRUD', espaco: { linhas: 1, eventos: 0, chavesRedis: 0, bytes: 8192 } })
  expect(contagemDoEspaco([a, arq('es')])).toBe('CRUD: linhas 1, eventos 0, chaves Redis 0')
})
