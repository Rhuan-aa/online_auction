// Campos do formulário da corrida → parâmetros do POST /corrida. Sem limite máximo: só inteiros positivos
// (leitores pode ser 0) e dinheiro válido.
import { paraCentavos } from '../formato.ts'
import type { Parametros } from './tipos.ts'

export interface Campos {
  licitantes: string
  lancesPorLicitante: string
  simultaneos: string
  leitores: string
  precoInicial: string
  incremento: string
}

export const PADRAO: Campos = {
  licitantes: '20', lancesPorLicitante: '10', simultaneos: '6', leitores: '4', precoInicial: '100,00', incremento: '1,00',
}

interface DefCampo { campo: keyof Campos; rotulo: string; dica: string; dinheiro?: boolean }

/** Ordem, rótulo e a frase do tooltip de cada campo. */
export const CAMPOS: DefCampo[] = [
  { campo: 'licitantes', rotulo: 'Licitantes', dica: 'Quantas pessoas diferentes dão lances.' },
  { campo: 'lancesPorLicitante', rotulo: 'Lances por licitante', dica: 'Quantos lances cada pessoa envia ao longo da corrida.' },
  { campo: 'simultaneos', rotulo: 'Lances simultâneos', dica: 'Quantos lances chegam ao mesmo tempo em cada arquitetura (threads de envio).' },
  { campo: 'leitores', rotulo: 'Leitores', dica: 'Quantos clientes consultam o preço sem parar durante a corrida; 0 desliga as consultas.' },
  { campo: 'precoInicial', rotulo: 'Preço inicial (R$)', dica: 'O preço com que o leilão começa, igual nas 5 arquiteturas.', dinheiro: true },
  { campo: 'incremento', rotulo: 'Incremento (R$)', dica: 'Quanto um lance precisa superar o preço atual para ser aceito.', dinheiro: true },
]

/** "12" → 12; aceita só dígitos (sem sinal, sem decimais) e inteiros seguros. */
function inteiro(texto: string, minimo: number): number | null {
  const t = texto.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) && n >= minimo ? n : null
}

/** Campos → parâmetros (dinheiro em centavos) ou a mensagem do primeiro campo inválido. */
export function validar(c: Campos): Parametros | string {
  const licitantes = inteiro(c.licitantes, 1)
  if (licitantes === null) return 'Licitantes: informe um número inteiro maior que zero.'
  const lancesPorLicitante = inteiro(c.lancesPorLicitante, 1)
  if (lancesPorLicitante === null) return 'Lances por licitante: informe um número inteiro maior que zero.'
  const simultaneos = inteiro(c.simultaneos, 1)
  if (simultaneos === null) return 'Lances simultâneos: informe um número inteiro maior que zero.'
  const leitores = inteiro(c.leitores, 0)
  if (leitores === null) return 'Leitores: informe um número inteiro (0 ou mais).'
  const precoInicial = paraCentavos(c.precoInicial)
  if (precoInicial === null) return 'Preço inicial: informe um valor em reais maior que zero, como 100,00.'
  const incremento = paraCentavos(c.incremento)
  if (incremento === null) return 'Incremento: informe um valor em reais maior que zero, como 1,00.'
  return { licitantes, lancesPorLicitante, simultaneos, leitores, precoInicial, incremento }
}
