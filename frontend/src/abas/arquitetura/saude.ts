import type { SaudeInfra } from '../../api.ts'

export interface Cartao { id: string; rotulo: string; status: 'UP' | 'DOWN'; ms: number | null; nota?: string }

export const SERVICOS = [
  { id: 'escrita', rotulo: 'leilao-escrita' },
  { id: 'leitura', rotulo: 'leilao-leitura' },
  { id: 'agendador', rotulo: 'agendador-leilao' },
] as const

const INFRA = [
  { id: 'postgres', rotulo: 'PostgreSQL' },
  { id: 'redis', rotulo: 'Redis' },
  { id: 'kafka', rotulo: 'Kafka' },
] as const

type Resp<T> = PromiseSettledResult<T>

export function cartaoServico(i: number, x: Resp<{ status: string; ms: number }> | undefined): Cartao {
  const s = SERVICOS[i]
  if (!x || x.status === 'rejected') return { ...s, status: 'DOWN', ms: null, nota: 'sem resposta' }
  return { ...s, status: x.value.status === 'UP' ? 'UP' : 'DOWN', ms: Math.round(x.value.ms) }
}

export const cartoesServicos = (r: Resp<{ status: string; ms: number }>[]): Cartao[] => SERVICOS.map((_, i) => cartaoServico(i, r[i]))

export function cartoesInfra(r: Resp<SaudeInfra>): Cartao[] {
  if (r.status === 'rejected') return INFRA.map((s) => ({ ...s, status: 'DOWN', ms: null, nota: 'sem resposta (leitura fora)' }))
  return INFRA.map((s) => {
    const v = r.value[s.id]
    return { ...s, status: v?.status === 'UP' ? 'UP' : 'DOWN', ms: v ? Math.round(v.ms) : null, nota: v?.erro }
  })
}
