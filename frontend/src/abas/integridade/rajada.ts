// Rajada: N lances ao mesmo tempo sobre a mesma versão do leilão. Parte pura; o disparo fica na aba.
import type { EstadoLeilao, EventoGravado, ResultadoLance } from '../../api.ts'
import type { DarLanceRequest } from '../../types.ts'
import { proximoLance } from '../../palco/palco.ts'

export const MIN_RAJADA = 2
/** O navegador abre ~6 conexões por porta: acima disso os lances esperariam na fila e não seriam simultâneos. */
export const MAX_RAJADA = 6

export function planejarRajada(
  e: EstadoLeilao, incrementoMinimo: number, n: number, mesmoValor: boolean,
): DarLanceRequest[] {
  const total = Math.min(MAX_RAJADA, Math.max(MIN_RAJADA, Math.trunc(n) || MIN_RAJADA))
  const base = proximoLance(e, incrementoMinimo)
  return Array.from({ length: total }, (_, i) => ({
    licitanteId: `licitante-${(i % 3) + 1}`,
    valor: mesmoValor ? base : base + i * incrementoMinimo,
  }))
}

export interface ResultadoRajada { pedido: DarLanceRequest; resultado: ResultadoLance; ms: number }

/** `colisoes` = tentativas extras que o servidor precisou (soma de tentativas - 1). */
export function resumirRajada(rs: ResultadoRajada[]) {
  let aceitos = 0, recusados = 0, conflitos = 0, colisoes = 0
  for (const { resultado } of rs) {
    if (resultado.tipo === 'aceito') aceitos++
    else if (resultado.tipo === 'recusado') recusados++
    else if (resultado.tipo === 'conflito') conflitos++
    if (resultado.tipo !== 'erro') colisoes += Math.max(0, resultado.tentativas - 1)
  }
  return { aceitos, recusados, conflitos, colisoes }
}

/** Versões 1..n, sem buraco nem repetição. */
export function versoesContiguas(eventos: EventoGravado[]): boolean {
  const versoes = eventos.map((e) => e.versao).sort((a, b) => a - b)
  return versoes.every((v, i) => v === i + 1)
}

/** Lances aceitos agrupados pela versão que gravaram (v+1, v+2, …), da menor para a maior. */
export function agruparAceitos(rs: ResultadoRajada[]): { versao: number; resultados: ResultadoRajada[] }[] {
  const porVersao = new Map<number, ResultadoRajada[]>()
  for (const r of rs) {
    if (r.resultado.tipo !== 'aceito') continue
    porVersao.set(r.resultado.versao, [...(porVersao.get(r.resultado.versao) ?? []), r])
  }
  return [...porVersao].sort((a, b) => a[0] - b[0]).map(([versao, resultados]) => ({ versao, resultados }))
}
