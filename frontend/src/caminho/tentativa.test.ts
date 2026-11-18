import { expect, test } from 'vitest'
import { INICIAL, reduzir, visao, type Acao, type EstadoAba } from './tentativa.ts'

const rodar = (...acoes: Acao[]): EstadoAba => acoes.reduce(reduzir, INICIAL)
const SEM_TEMPO = { gravacaoMs: null, propagacaoMs: null }

test('clique: gravando, sem tempos', () => {
  expect(visao(rodar({ tipo: 'clique', em: 100 }))).toMatchObject({ fase: 'gravando', ...SEM_TEMPO, mensagem: null })
})
test('aceito: gravado com gravação', () => {
  const v = visao(rodar({ tipo: 'clique', em: 100 }, { tipo: 'aceito', versao: 5, respostaEm: 130, sseEm: null }))
  expect(v).toMatchObject({ fase: 'gravado', gravacaoMs: 30, propagacaoMs: null })
})
test('sse da mesma versão: completo com propagação', () => {
  const v = visao(rodar({ tipo: 'clique', em: 100 }, { tipo: 'aceito', versao: 5, respostaEm: 130, sseEm: null }, { tipo: 'sse', versao: 5, quando: 190 }))
  expect(v).toMatchObject({ fase: 'completo', gravacaoMs: 30, propagacaoMs: 60 })
})
test('novo clique zera os tempos do lance anterior', () => {
  const s = rodar({ tipo: 'clique', em: 100 }, { tipo: 'aceito', versao: 5, respostaEm: 130, sseEm: 150 }, { tipo: 'clique', em: 500 })
  expect(visao(s)).toMatchObject({ fase: 'gravando', ...SEM_TEMPO })
})
test('recusado: para, mostra a mensagem, sem caminho aceso nem tempos', () => {
  const s = rodar({ tipo: 'clique', em: 100 }, { tipo: 'aceito', versao: 5, respostaEm: 130, sseEm: 150 }, { tipo: 'clique', em: 500 }, { tipo: 'recusado', mensagem: 'Lance recusado' })
  expect(visao(s)).toEqual({ fase: null, ...SEM_TEMPO, mensagem: 'Lance recusado', nota: null })
})
test('timeout: nota de SSE ausente; chegada posterior a desfaz', () => {
  const base = rodar({ tipo: 'clique', em: 0 }, { tipo: 'aceito', versao: 5, respostaEm: 10, sseEm: null }, { tipo: 'expirou', versao: 5 })
  expect(visao(base)).toMatchObject({ fase: 'gravado', nota: 'SSE não chegou em 5 s' })
  expect(visao(reduzir(base, { tipo: 'sse', versao: 5, quando: 6000 })).nota).toBeNull()
})
test('SSE antes da resposta: sem propagação, com nota', () => {
  const v = visao(rodar({ tipo: 'clique', em: 0 }, { tipo: 'aceito', versao: 5, respostaEm: 20, sseEm: 10 }))
  expect(v).toMatchObject({ fase: 'completo', gravacaoMs: 20, propagacaoMs: null, nota: 'SSE chegou antes da resposta do POST' })
})
test('SSE sem medição pendente: externo, sem tempos', () => {
  expect(visao(rodar({ tipo: 'sse', versao: 7, quando: 50 }))).toMatchObject({ fase: 'externo', ...SEM_TEMPO })
})
test('guarda no máximo 10 medições', () => {
  let s = INICIAL
  for (let i = 1; i <= 12; i++) s = reduzir(reduzir(s, { tipo: 'clique', em: i }), { tipo: 'aceito', versao: i, respostaEm: i + 1, sseEm: null })
  expect(s.medicoes).toHaveLength(10)
  expect(s.medicoes[0].versao).toBe(3)
})
