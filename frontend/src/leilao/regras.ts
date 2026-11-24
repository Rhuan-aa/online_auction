// Regras puras do leilão de demonstração: quando dá para dar lance, qual o próximo lance, quem dá e a situação da tela.
import { ErroHttp, type EstadoLeilao } from '../api.ts'

export interface EventoVisto { tipo: string; versao: number; quando: number }

export type Situacao = 'sem-leilao' | 'carregando' | 'ao-vivo' | 'desatualizado' | 'nao-encontrado' | 'indisponivel'

export const VENDEDOR = 'vendedor-1'

export function podeDarLance(e: EstadoLeilao | null, agora: number): { pode: boolean; motivo?: string } {
  if (!e) return { pode: false, motivo: 'Sem leilão escolhido' }
  if (e.status === 'CANCELADO') return { pode: false, motivo: 'Leilão cancelado' }
  if (e.status === 'ENCERRADO' || (e.status === 'ABERTO' && Date.parse(e.fimEm) <= agora)) {
    return { pode: false, motivo: 'Leilão encerrado' }
  }
  if (e.status === 'CRIADO') return { pode: false, motivo: 'Leilão ainda não abriu (o agendador leva alguns segundos)' }
  return { pode: true }
}

/** Prazos do leilão de demonstração: curtos para ver o agendador encerrar durante a apresentação. */
export const PRAZOS = [
  { rotulo: '1 min', ms: 60_000 },
  { rotulo: '2 min', ms: 2 * 60_000 },
  { rotulo: '5 min', ms: 5 * 60_000 },
  { rotulo: '2 h', ms: 2 * 60 * 60_000 },
] as const

/** O que a tela diz sobre o fim: contagem regressiva, espera pelo agendador ou o resultado. */
export function fimDoLeilao(e: EstadoLeilao, agora: number): string | null {
  if (e.status === 'ENCERRADO') {
    return e.liderId ? `vencedor ${e.liderId}` : 'sem lances, sem vencedor'
  }
  if (e.status !== 'ABERTO') return null
  const resta = Date.parse(e.fimEm) - agora
  if (resta <= 0) return 'prazo acabou; aguardando o agendador encerrar…'
  const s = Math.ceil(resta / 1000)
  const relogio = s >= 3600
    ? `${Math.floor(s / 3600)}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
    : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return `encerra em ${relogio}${s < 30 ? ' (lance agora prorroga +30 s)' : ''}`
}

/** Sem lance ainda, o próximo lance é o preço inicial (que vem do evento LeilaoCriado); 0 se ainda não se sabe. */
export function proximoLance(e: EstadoLeilao, incrementoMinimo: number, precoInicial?: number | null): number {
  if (e.precoAtual == null) return precoInicial ?? 0
  return e.precoAtual + incrementoMinimo
}

/** Quem dá o próximo lance: um licitante que não seja o líder atual. */
export function licitanteDaVez(liderId: string | null): string {
  return liderId === 'licitante-1' ? 'licitante-2' : 'licitante-1'
}

export function situacaoDoLeilao(entrada: {
  leilaoId: string | null
  estado: EstadoLeilao | null
  erro: ErroHttp | null
  sseCaiu: boolean
}): Situacao {
  const { leilaoId, estado, erro, sseCaiu } = entrada
  if (!leilaoId) return 'sem-leilao'
  if (!estado) {
    // 404: não existe; 400: o id nem é um UUID (o Spring recusa antes de procurar)
    if (erro?.status === 404 || erro?.status === 400) return 'nao-encontrado'
    return erro || sseCaiu ? 'indisponivel' : 'carregando'
  }
  return erro || sseCaiu ? 'desatualizado' : 'ao-vivo'
}
