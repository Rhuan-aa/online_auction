// espelho de backend/contratos — mudou lá, muda aqui
// Dinheiro em centavos; datas em string ISO-8601.

export const Topicos = {
  EVENTOS_LEILAO: 'leilao.eventos',
  COMANDOS_AGENDADOR: 'leilao.comandos-agendador',
} as const

export const TiposEvento = {
  LEILAO_CRIADO: 'LeilaoCriado.v1',
  LEILAO_INICIADO: 'LeilaoIniciado.v1',
  LANCE_REGISTRADO: 'LanceRegistrado.v1',
  LEILAO_PRORROGADO: 'LeilaoProrrogado.v1',
  LEILAO_ENCERRADO: 'LeilaoEncerrado.v1',
  LEILAO_CANCELADO: 'LeilaoCancelado.v1',
} as const

export interface LeilaoCriado { vendedorId: string; titulo: string; precoInicial: number; incrementoMinimo: number; inicioEm: string; fimEm: string }
export interface LeilaoIniciado { fimEm: string }
export interface LanceRegistrado { licitanteId: string; valor: number }
export interface LeilaoProrrogado { novoFimEm: string }
export interface LeilaoEncerrado { vencedorId: string | null; valorVencedor: number | null }
export interface LeilaoCancelado { motivo: string }

export interface EnvelopeEvento<P> {
  id: number
  leilaoId: string
  versao: number // versão do leilão após o evento (1..n)
  tipo: string
  criadoEm: string
  dados: P
}

export type CriarLeilaoRequest = LeilaoCriado
export interface DarLanceRequest { licitanteId: string; valor: number }
