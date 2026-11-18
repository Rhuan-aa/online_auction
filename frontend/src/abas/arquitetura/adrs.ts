import type { Aba } from '../../rota.ts'

export const ADRS: { id: 'ADR-001' | 'ADR-002' | 'ADR-003' | 'ADR-004'; titulo: string; decisao: string; aba: Aba }[] = [
  { id: 'ADR-001', titulo: 'Arquitetura baseada em eventos', aba: 'rede',
    decisao: 'Os acontecimentos do leilão passam por um broker, e cada parte os consome no seu próprio ritmo, sem que quem grava o lance dependa dela.' },
  { id: 'ADR-002', titulo: 'Event Sourcing', aba: 'auditoria',
    decisao: 'O leilão é guardado como uma sequência imutável de eventos no PostgreSQL, e o estado é reconstruído por replay.' },
  { id: 'ADR-003', titulo: 'Cache versionado', aba: 'desempenho',
    decisao: 'O estado vem de uma cópia (checkpoint e Redis) acrescida apenas dos eventos posteriores à versão dela, em vez de reler tudo.' },
  { id: 'ADR-004', titulo: 'Apache Kafka', aba: 'arquitetura',
    decisao: 'O Kafka é o broker dos eventos: mantém o log retido em disco e a ordem por leilão, e aguenta o pico de lances no fim.' },
]
