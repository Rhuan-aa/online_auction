import { describe, expect, test } from 'vitest'
import { acaoDaTecla, aplicar, limitar } from './navegacao.ts'

describe('aplicar', () => {
  test('avança e volta uma tela', () => {
    expect(aplicar('proxima', 2, 7)).toBe(3)
    expect(aplicar('anterior', 2, 7)).toBe(1)
  })
  test('para nas pontas em vez de dar a volta', () => {
    expect(aplicar('proxima', 6, 7)).toBe(6)
    expect(aplicar('anterior', 0, 7)).toBe(0)
  })
  test('vai direto para a primeira e a última', () => {
    expect(aplicar('primeira', 4, 7)).toBe(0)
    expect(aplicar('ultima', 1, 7)).toBe(6)
  })
})

test('limitar corrige índices fora da faixa', () => {
  expect(limitar(-3, 7)).toBe(0)
  expect(limitar(99, 7)).toBe(6)
  expect(limitar(0, 0)).toBe(0)
})

describe('acaoDaTecla', () => {
  test('setas e passador de slides navegam', () => {
    expect(acaoDaTecla('ArrowRight', 'BODY')).toBe('proxima')
    expect(acaoDaTecla('PageDown', 'BUTTON')).toBe('proxima')
    expect(acaoDaTecla('ArrowLeft', 'BODY')).toBe('anterior')
    expect(acaoDaTecla('PageUp', undefined)).toBe('anterior')
    expect(acaoDaTecla('Home', 'BODY')).toBe('primeira')
    expect(acaoDaTecla('End', 'BODY')).toBe('ultima')
  })
  test('dentro de um campo as setas são do campo, mas o Esc sai', () => {
    expect(acaoDaTecla('ArrowRight', 'INPUT')).toBeNull()
    expect(acaoDaTecla('ArrowLeft', 'SELECT')).toBeNull()
    expect(acaoDaTecla('Escape', 'INPUT')).toBe('sair')
  })
  test('outras teclas não fazem nada', () => expect(acaoDaTecla('a', 'BODY')).toBeNull())
})
