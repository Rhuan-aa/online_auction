// Layout puro do waterfall: cada requisição vira uma barra numa linha do tempo compartilhada (frações de 0 a 1).
import type { Registro } from '../../rede.ts'

export const MAX_LINHAS = 30

export interface LinhaWaterfall {
  registro: Registro
  rotulo: string
  inicio: number
  largura: number
  cor: string
  ponto: boolean
}

export function corDoStatus(status: number): string {
  if (status >= 200 && status < 400) return 'var(--sucesso)'
  if (status >= 400 && status < 500) return 'var(--aviso)'
  return 'var(--perigo)' // 5xx e 0 (falha de rede)
}

export function layoutWaterfall(rs: Registro[]): { duracao: number; linhas: LinhaWaterfall[] } {
  const ultimos = rs.slice(-MAX_LINHAS)
  if (ultimos.length === 0) return { duracao: 0, linhas: [] }
  const t0 = Math.min(...ultimos.map((r) => r.quando))
  const t1 = Math.max(...ultimos.map((r) => r.quando + r.ms))
  const duracao = t1 - t0
  const frac = (ms: number) => (duracao > 0 ? ms / duracao : 0)
  return {
    duracao,
    linhas: ultimos.map((r) => ({
      registro: r,
      rotulo: `${r.metodo} ${r.rota}`,
      inicio: frac(r.quando - t0),
      largura: frac(r.ms),
      cor: corDoStatus(r.status),
      ponto: r.tipo === 'sse',
    })),
  }
}
