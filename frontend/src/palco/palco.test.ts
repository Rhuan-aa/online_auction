import { describe, expect, test } from 'vitest'
import { ErroHttp, type EstadoLeilao } from '../api.ts'
import { acumularEventos, podeDarLance, proximoLance, situacaoDoPalco, type EventoVisto } from './palco.ts'

const AGORA = Date.parse('2026-11-18T12:00:00Z')
const estado: EstadoLeilao = {
  leilaoId: 'x', titulo: 'Relógio', status: 'ABERTO', precoAtual: 10000, liderId: null,
  fimEm: '2026-11-18T13:00:00Z', versao: 3,
}

describe('podeDarLance', () => {
  test('aberto e dentro do prazo pode', () => expect(podeDarLance(estado, AGORA)).toEqual({ pode: true }))
  test('não deixa dar lance em leilão encerrado', () =>
    expect(podeDarLance({ ...estado, status: 'ENCERRADO' }, AGORA)).toEqual({ pode: false, motivo: 'Leilão encerrado' }))
  test('prazo vencido conta como encerrado', () =>
    expect(podeDarLance(estado, Date.parse('2026-11-18T13:00:01Z'))).toEqual({ pode: false, motivo: 'Leilão encerrado' }))
  test('cancelado', () =>
    expect(podeDarLance({ ...estado, status: 'CANCELADO' }, AGORA)).toEqual({ pode: false, motivo: 'Leilão cancelado' }))
  test('agendado ainda não abriu', () =>
    expect(podeDarLance({ ...estado, status: 'CRIADO' }, AGORA)).toEqual({ pode: false, motivo: 'Leilão ainda não abriu' }))
  test('sem leilão em foco', () => expect(podeDarLance(null, 0).motivo).toBe('Sem leilão em foco'))
})

describe('proximoLance', () => {
  test('preço atual mais incremento', () => expect(proximoLance(estado, 500)).toBe(10500))
  test('sem lance ainda usa o preço inicial (não soma incremento)', () =>
    expect(proximoLance({ ...estado, precoAtual: null }, 500, 10000)).toBe(10000))
  test('sem lance e sem preço inicial conhecido devolve 0', () =>
    expect(proximoLance({ ...estado, precoAtual: null }, 500)).toBe(0))
})

describe('acumularEventos', () => {
  const ev = (versao: number): EventoVisto => ({ tipo: 'LanceRegistrado', versao, quando: versao })
  test('mais recente primeiro, no máximo 5, sem repetir versão', () => {
    let lista: EventoVisto[] = []
    for (const v of [1, 2, 3, 3, 4, 5, 6, 7]) lista = acumularEventos(lista, ev(v))
    expect(lista.map((e) => e.versao)).toEqual([7, 6, 5, 4, 3])
  })
  test('respeita max', () => expect(acumularEventos([ev(1), ev(2)], ev(3), 2).map((e) => e.versao)).toEqual([3, 1]))
})

describe('situacaoDoPalco', () => {
  test('sem id', () => expect(situacaoDoPalco({ leilaoId: null, estado: null, erro: null, sseCaiu: false })).toBe('sem-leilao'))
  test('carregando', () => expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: null, sseCaiu: false })).toBe('carregando'))
  test('ao vivo', () => expect(situacaoDoPalco({ leilaoId: 'x', estado, erro: null, sseCaiu: false })).toBe('ao-vivo'))
  test('erro de rede com estado anterior fica desatualizado', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado, erro: new ErroHttp(0, 'rede'), sseCaiu: false })).toBe('desatualizado'))
  test('SSE caiu com estado anterior fica desatualizado', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado, erro: null, sseCaiu: true })).toBe('desatualizado'))
  test('sem estado e erro de rede fica indisponivel', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: new ErroHttp(0, 'rede'), sseCaiu: false })).toBe('indisponivel'))
  test('sem estado e erro 400 (id que não é UUID) fica nao-encontrado', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: new ErroHttp(400, 'ruim'), sseCaiu: false })).toBe('nao-encontrado'))
  test('sem estado e erro 500 fica indisponivel', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: new ErroHttp(500, 'caiu'), sseCaiu: false })).toBe('indisponivel'))
  test('sem estado e SSE caído fica indisponivel', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: null, sseCaiu: true })).toBe('indisponivel'))
  test('404 fica nao-encontrado', () =>
    expect(situacaoDoPalco({ leilaoId: 'x', estado: null, erro: new ErroHttp(404, ''), sseCaiu: false })).toBe('nao-encontrado'))
})
