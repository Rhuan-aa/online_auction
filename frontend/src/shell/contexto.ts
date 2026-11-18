import { createContext } from 'react'
import type { Aba } from '../secoes.ts'

/**
 * Onde um slide está: a seção e o número do seu passo. O App fornece a seção atual (passo 1);
 * <Passos> fornece o passo de cada filho. O <Slide> usa isto para montar o kicker sozinho.
 */
export const SlideContexto = createContext<{ aba: Aba; passo: number }>({ aba: 'integridade', passo: 1 })
