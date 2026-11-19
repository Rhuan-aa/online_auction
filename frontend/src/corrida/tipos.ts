// Espelho do contrato do leilao-corrida: dinheiro em centavos, tempos em ms.

export interface Parametros {
  licitantes: number
  lancesPorLicitante: number
  simultaneos: number
  leitores: number
  precoInicial: number
  incremento: number
}

type StatusArq = 'rodando' | 'terminou' | 'parada' | 'erro'

export interface Tempos { p50: number; p95: number }

export interface ArqFoto {
  id: string
  nome: string
  descricao: string
  status: StatusArq
  erro: string | null
  terminouEmMs: number | null
  total: number
  enviados: number
  aceitos: number
  recusados: number
  conflitos: number
  retentativas: number
  lancesPorSegundo: number
  escrita: Tempos & { amostras: number }
  leitura: Tempos & {
    consultas: number
    desatualizadas: number
    pctDesatualizadas: number
    atrasoMedioVersoes: number
    atrasoMedioMs: number
  }
  curva: { versao: number; ms: number }[]
  operacoes: { leiturasBanco: number; escritasBanco: number; opsRedis: number; porLance: number }
  precoAtual: number | null
  liderAtual: string | null
  versaoAtual: number
  // só no evento `fim`
  integridade?: { ok: boolean; umVencedor: boolean; precoFinalCorreto: boolean; lancesPerdidos: number; detalhe?: string | null }
  espaco?: { linhas: number; eventos: number; chavesRedis: number; bytes: number }
  auditoria?: { suporta: boolean; eventos: number }
  precoFinal?: number | null
  vencedor?: string | null
}

export interface Foto {
  corridaId: string
  parametros: Parametros
  decorridoMs: number
  rodando: boolean
  arquiteturas: ArqFoto[]
}

/** As 6 arquiteturas na ordem do contrato. Nome e descrição servem para as raias antes da primeira foto. */
export const ARQUITETURAS = [
  { id: 'crud', nome: 'CRUD simples', descricao: 'UPDATE direto na linha, sem controle de concorrência' },
  { id: 'crud-cache', nome: 'CRUD + cache', descricao: 'UPDATE com versão (otimista) e cópia no Redis' },
  { id: 'es', nome: 'Event Sourcing puro', descricao: 'Relê todos os eventos a cada lance e a cada consulta' },
  { id: 'es-snapshot', nome: 'ES + snapshot', descricao: 'Parte de um snapshot gravado a cada 50 eventos' },
  { id: 'es-cache', nome: 'ES + cache', descricao: 'Eventos imutáveis + cópia versionada no Redis' },

] as const

/** Cor da arquitetura (token --arq-1…6), a mesma nas raias, legendas, gráficos e placar. */
export function corDe(id: string): string {
  const i = ARQUITETURAS.findIndex((a) => a.id === id)
  return i < 0 ? 'var(--tinta-suave)' : `var(--arq-${i + 1})`
}

/** Selo obrigatório ao lado de toda medição da corrida. */
export const SELO = 'medido nesta máquina; as 6 rodaram juntas e disputaram CPU e banco'

/** Ressalvas honestas da comparação, ao lado do selo. */
export const RESSALVAS = 'Cuidados ao comparar: as sequências de lances divergem entre as arquiteturas, porque cada uma segue o próprio preço; '


/** O que "leitura desatualizada" quer dizer no CRUD simples (que não tem atraso de projeção). */
export const NOTA_CRUD = 'No CRUD simples, "desatualizada" é a versão voltando para trás: um UPDATE sobrescreve outro, sem controle de concorrência. Não é atraso de cópia.'
