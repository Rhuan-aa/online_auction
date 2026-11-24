import { describe, expect, test } from 'vitest'
import type { EstadoLeilao, Notificacao } from '../api.ts'
import { avisoAtual, INCREMENTO, nomeDe, PRECO_INICIAL, situacaoDe, valorDoLance } from './regras.ts'

const aberto: EstadoLeilao = {
  leilaoId: 'm', titulo: 'Mini leilão', status: 'ABERTO', precoAtual: PRECO_INICIAL, liderId: null,
  fimEm: '2026-11-24T20:00:00Z', versao: 2,
}

describe('situacaoDe', () => {
  test('sem lance ainda', () => expect(situacaoDe(aberto, 'ana', false)).toBe('sem-lance'))
  test('quem lidera está ganhando', () => expect(situacaoDe({ ...aberto, liderId: 'ana' }, 'ana', true)).toBe('ganhando'))
  test('quem deu lance e não lidera foi superado', () =>
    expect(situacaoDe({ ...aberto, liderId: 'bruno' }, 'ana', true)).toBe('superado'))
  test('encerrado: o líder venceu, quem deu lance perdeu, quem não deu ficou de fora', () => {
    const fim = { ...aberto, status: 'ENCERRADO' as const, liderId: 'bruno' }
    expect(situacaoDe(fim, 'bruno', true)).toBe('venceu')
    expect(situacaoDe(fim, 'ana', true)).toBe('perdeu')
    expect(situacaoDe(fim, 'ana', false)).toBe('fora')
  })
  test('sem leilão', () => expect(situacaoDe(null, 'ana', false)).toBe('sem-lance'))
})

describe('valorDoLance', () => {
  test('primeiro lance é o preço inicial', () => expect(valorDoLance(aberto)).toBe(PRECO_INICIAL))
  test('depois soma o incremento', () =>
    expect(valorDoLance({ ...aberto, liderId: 'ana', precoAtual: 10_500 })).toBe(10_500 + INCREMENTO))
})

describe('avisoAtual', () => {
  const n = (leilaoId: string, mensagem: string, tipo: Notificacao['tipo'] = 'SUPERADO'): Notificacao =>
    ({ destinatarioId: 'ana', leilaoId, tipo, mensagem })
  test('mostra só o último aviso deste leilão enquanto a pessoa está superada', () =>
    expect(avisoAtual([n('m', '1'), n('m', '2'), n('outro', 'x')], 'm', 'superado')?.mensagem).toBe('2'))
  test('some quando a pessoa volta a liderar', () =>
    expect(avisoAtual([n('m', '1')], 'm', 'ganhando')).toBeNull())
  test('quem perdeu no fim continua vendo que foi superado', () =>
    expect(avisoAtual([n('m', '1')], 'm', 'perdeu')?.mensagem).toBe('1'))
  test('o aviso de vitória fica para quem venceu', () =>
    expect(avisoAtual([n('m', '1'), n('m', 'v', 'VENCEU')], 'm', 'venceu')?.mensagem).toBe('v'))
  test('sem aviso deste leilão', () => expect(avisoAtual([n('outro', 'x')], 'm', 'superado')).toBeNull())
})

test('nomeDe', () => {
  expect(nomeDe('ana')).toBe('Ana')
  expect(nomeDe(null)).toBe('—')
})
