// Regras puras do palco: quando dá para dar lance, qual o próximo lance, o feed de eventos e a situação da tela.
import { ErroHttp, type EstadoLeilao } from '../api.ts'

export interface EventoVisto { tipo: string; versao: number; quando: number }

export type SituacaoPalco = 'sem-leilao' | 'carregando' | 'ao-vivo' | 'desatualizado' | 'nao-encontrado' | 'indisponivel'

export function podeDarLance(e: EstadoLeilao | null, agora: number): { pode: boolean; motivo?: string } {
  if (!e) return { pode: false, motivo: 'Sem leilão em foco' }
  if (e.status === 'CANCELADO') return { pode: false, motivo: 'Leilão cancelado' }
  if (e.status === 'ENCERRADO' || (e.status === 'ABERTO' && Date.parse(e.fimEm) <= agora)) {
    return { pode: false, motivo: 'Leilão encerrado' }
  }
  if (e.status === 'CRIADO') return { pode: false, motivo: 'Leilão ainda não abriu' }
  return { pode: true }
}

/** Sem lance ainda, o próximo lance é o preço inicial (que vem do evento LeilaoCriado); 0 se ainda não se sabe. */
export function proximoLance(e: EstadoLeilao, incrementoMinimo: number, precoInicial?: number | null): number {
  if (e.precoAtual == null) return precoInicial ?? 0
  return e.precoAtual + incrementoMinimo
}

export function acumularEventos(lista: EventoVisto[], novo: EventoVisto, max = 5): EventoVisto[] {
  if (lista.some((e) => e.versao === novo.versao)) return lista
  return [novo, ...lista].slice(0, max)
}

export function situacaoDoPalco(entrada: {
  leilaoId: string | null
  estado: EstadoLeilao | null
  erro: ErroHttp | null
  sseCaiu: boolean
}): SituacaoPalco {
  const { leilaoId, estado, erro, sseCaiu } = entrada
  if (!leilaoId) return 'sem-leilao'
  if (!estado) {
    // 404: não existe; 400: o id nem é um UUID (o Spring recusa antes de procurar)
    if (erro?.status === 404 || erro?.status === 400) return 'nao-encontrado'
    return erro || sseCaiu ? 'indisponivel' : 'carregando'
  }
  return erro || sseCaiu ? 'desatualizado' : 'ao-vivo'
}
