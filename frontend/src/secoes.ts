// Registro das seções (as 6 perguntas) e dos passos de cada uma, no modo apresentação.
// Cada passo é um slide; `titulo` aparece no kicker ("PERGUNTA 1 · PASSO 2/3 · SIMULAÇÃO COMPLETA").
// Enquanto uma seção não é convertida em slides, ela inteira cabe num slide largo só (passo 1):
// a lista de passos já fica aqui, mas a navegação expõe só o passo 1 até `convertida` virar true.

export type Aba = 'integridade' | 'desempenho' | 'rede' | 'auditoria' | 'arquitetura' | 'e-se-fosse'

export interface Passo { id: string; titulo: string }

export interface Secao {
  id: Aba
  rotulo: string
  pergunta: string
  convertida: boolean
  passos: Passo[]
}

const POR_QUE: Passo = { id: 'por-que', titulo: 'Por que funciona' }

export const SECOES: Secao[] = [
  {
    id: 'integridade', rotulo: 'Integridade', pergunta: 'Dois lances ao mesmo tempo: quem ganha?', convertida: true,
    passos: [
      { id: 'rajada', titulo: 'Rajada' },
      { id: 'simulacao', titulo: 'Simulação completa' },
      POR_QUE,
    ],
  },
  {
    id: 'desempenho', rotulo: 'Desempenho', pergunta: 'O cache ajuda mesmo?', convertida: true,
    passos: [
      { id: 'comparar', titulo: 'Comparar A×B×C' },
      { id: 'resultado', titulo: 'Resultado' },
      { id: 'por-dentro', titulo: 'Por dentro do cache' },
      { id: 'tempo-versao', titulo: 'Tempo × versão' },
      POR_QUE,
    ],
  },
  {
    id: 'rede', rotulo: 'Rede', pergunta: 'Quanto custa ficar ao vivo?', convertida: false,
    passos: [
      { id: 'custo', titulo: 'Custo por rota' },
      { id: 'requisicoes', titulo: 'Últimas 30 requisições' },
      { id: 'experimento', titulo: 'SSE × polling' },
      POR_QUE,
    ],
  },
  {
    id: 'auditoria', rotulo: 'Auditoria', pergunta: 'Dá para voltar no tempo?', convertida: false,
    passos: [
      { id: 'linha-do-tempo', titulo: 'Linha do tempo' },
      { id: 'viagem', titulo: 'Viagem no tempo' },
      { id: 'reconstruir', titulo: 'Reconstruir o cache' },
      POR_QUE,
    ],
  },
  {
    id: 'arquitetura', rotulo: 'Arquitetura', pergunta: 'Por onde passa um lance?', convertida: false,
    passos: [
      { id: 'caminho', titulo: 'Caminho de um lance' },
      { id: 'saude', titulo: 'Saúde dos serviços' },
      { id: 'decisoes', titulo: 'Decisões (ADRs)' },
    ],
  },
  {
    id: 'e-se-fosse', rotulo: 'E se fosse…?', pergunta: 'Por que não do jeito comum?', convertida: false,
    passos: [
      { id: 'crud', titulo: 'CRUD × Event Sourcing' },
      { id: 'cqrs', titulo: 'CQRS × cache' },
      { id: 'broker', titulo: 'REST síncrono × broker' },
      { id: 'kafka', titulo: 'RabbitMQ × Kafka' },
      { id: 'por-que', titulo: 'Por que (resumo)' },
    ],
  },
]

export function ehAba(s: string): s is Aba {
  return SECOES.some((a) => a.id === s)
}

export function secaoDe(aba: Aba): Secao {
  return SECOES.find((s) => s.id === aba) ?? SECOES[0]
}

/** Quantos passos a navegação expõe: todos se a seção já foi convertida em slides, senão só o 1. */
export function passosVisiveis(aba: Aba): number {
  const s = secaoDe(aba)
  return s.convertida ? s.passos.length : 1
}

/** "Pergunta 1 · passo 2/3 · Simulação completa" (o CSS põe em caixa alta). */
export function kickerDe(aba: Aba, passo: number): string {
  const i = SECOES.findIndex((s) => s.id === aba)
  const s = SECOES[i] ?? SECOES[0]
  const total = passosVisiveis(s.id)
  const titulo = s.convertida ? s.passos[passo - 1]?.titulo : undefined
  return `Pergunta ${i + 1} · passo ${passo}/${total}${titulo ? ` · ${titulo}` : ''}`
}
