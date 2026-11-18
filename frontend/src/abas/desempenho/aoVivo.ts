// Ao vivo: obtenções por segundo e tempo médio a partir de duas leituras do medidor leilao.estado.obter.
export interface Leitura { count: number; total: number; quando: number }

/** `total` vem em segundos (TOTAL_TIME do Actuator); `quando` em ms. */
export function taxas(anterior: Leitura, atual: Leitura): { porSegundo: number; msMedio: number | null } {
  const n = atual.count - anterior.count
  const segundos = (atual.quando - anterior.quando) / 1000
  if (n <= 0 || segundos <= 0) return { porSegundo: 0, msMedio: null } // sem obtenções (ou contador reiniciado)
  return { porSegundo: n / segundos, msMedio: ((atual.total - anterior.total) / n) * 1000 }
}

export const PONTOS_AO_VIVO = 30

export function anexarPonto(serie: number[], valor: number, max = PONTOS_AO_VIVO): number[] {
  return [...serie, valor].slice(-max)
}
