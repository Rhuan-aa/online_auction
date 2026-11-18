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
