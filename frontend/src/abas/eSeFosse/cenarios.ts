// Lógica pura da aba "E se fosse…?": nada aqui mede o sistema, são ilustrações.
import type { EventoGravado } from '../../api.ts'
import { dinheiro } from '../../formato.ts'

export const MIN_LANCES = 2
export const SEM_LANCES = 'Escolha um leilão com lances no palco'
const MAX_LANCES = 8

interface Lance { versao: number; licitanteId: string; valor: number }

const ehLance = (e: EventoGravado) => e.tipo.startsWith('LanceRegistrado')

/** Só os lances, os `max` mais recentes: é o que as animações reais percorrem. */
export function ultimosLances(eventos: EventoGravado[], max = MAX_LANCES): EventoGravado[] {
  return eventos.filter(ehLance).slice(-max)
}

function comoLance(e: EventoGravado): Lance {
  const d = (e.dados ?? {}) as { licitanteId?: string; valor?: number }
  return { versao: e.versao, licitanteId: d.licitanteId ?? '?', valor: d.valor ?? 0 }
}

export interface PassoCrud { passo: number; linha: { preco: number | null; lider: string | null; status: string }; apagado: string }

/** Uma "tabela" de uma linha que sofre UPDATE a cada lance; `apagado` é o que o UPDATE destruiu. */
export function crud(eventos: EventoGravado[]): PassoCrud[] {
  const lances = eventos.filter(ehLance).map(comoLance)
  return lances.map((l, i) => ({
    passo: i + 1,
    linha: { preco: l.valor, lider: l.licitanteId, status: 'ABERTO' },
    apagado: i === 0 ? '' : `lance de ${lances[i - 1].licitanteId} de ${dinheiro(lances[i - 1].valor)}`,
  }))
}

export interface PassoCqrs { passo: number; escrita: number | null; replica: number | null; precoVelho: boolean }

/** A réplica de leitura mostra o preço de `atrasoPassos` lances antes (consistência eventual). */
export function cqrsAtrasado(eventos: EventoGravado[], atrasoPassos = 2): PassoCqrs[] {
  const valores = eventos.filter(ehLance).map((e) => comoLance(e).valor)
  return valores.map((escrita, i) => {
    const replica = i - atrasoPassos >= 0 ? valores[i - atrasoPassos] : null
    return { passo: i + 1, escrita, replica, precoVelho: replica != null && replica !== escrita }
  })
}

/** Passo seguinte do player; para no último. */
export const avancar = (passo: number, total: number) => Math.min(total, passo + 1)

/** Mantém o passo dentro de 0..total (rede de segurança se os dados mudarem sob o player). */
export const limitar = (passo: number, total: number) => Math.max(0, Math.min(total, passo))

/** Identidade da janela de lances: muda com o leilão ou com os lances mostrados, e reinicia o player. */
export function chaveJanela(leilaoId: string | null, lances: EventoGravado[]): string {
  return `${leilaoId ?? ''}:${lances[0]?.versao ?? 0}-${lances.at(-1)?.versao ?? 0}`
}

/** Aviso quando só os últimos lances são mostrados; vazio se todos cabem. */
export function notaRecorte(eventos: EventoGravado[], mostrados: number): string | undefined {
  const total = eventos.filter(ehLance).length
  return total > mostrados ? `mostrando os últimos ${mostrados} de ${total} lances` : undefined
}

// ---- Roteiros fixos (cartões 3 e 4) ----

export type Tom = 'ok' | 'erro' | 'aviso'
export interface Linha { texto: string; tom?: Tom }
export interface PassoFixo { legenda: string; nosso: Linha[]; alternativa: Linha[] }
export interface Roteiro { passos: PassoFixo[]; conclusao: string }

export const ROTEIRO_REST: Roteiro = {
  passos: [
    {
      legenda: 'Chega um lance de R$ 130,00 no serviço de escrita.',
      nosso: [{ texto: 'cliente → escrita: POST /lances' }],
      alternativa: [{ texto: 'cliente → escrita: POST /lances' }],
    },
    {
      legenda: 'A escrita valida o lance. Nosso sistema grava o lance e o evento da outbox na mesma transação.',
      nosso: [{ texto: 'lance gravado + outbox, na mesma transação', tom: 'ok' }, { texto: 'lance aceito: o cliente recebe 200', tom: 'ok' }],
      alternativa: [{ texto: 'a escrita chama notificações (REST) antes de confirmar o lance' }],
    },
    {
      legenda: 'O serviço de notificações está fora do ar. Quem espera por ele quebra; quem publica depois do commit segue.',
      nosso: [
        { texto: 'lance gravado + outbox, na mesma transação', tom: 'ok' },
        { texto: 'lance aceito: o cliente recebe 200', tom: 'ok' },
        { texto: 'o relay publica no Kafka depois do commit', tom: 'ok' },
        { texto: 'notificações fora do ar: o evento espera no log', tom: 'aviso' },
      ],
      alternativa: [
        { texto: 'escrita → notificações (REST): sem resposta', tom: 'erro' },
        { texto: 'lance não confirmado: o cliente recebe erro', tom: 'erro' },
      ],
    },
    {
      legenda: 'As notificações voltam.',
      nosso: [
        { texto: 'notificações voltam e leem o que perderam do log', tom: 'ok' },
        { texto: 'quem foi superado é avisado, só um pouco depois', tom: 'ok' },
      ],
      alternativa: [{ texto: 'o cliente precisa tentar de novo, e o lance já pode ter sido perdido para outro', tom: 'erro' }],
    },
  ],
  conclusao: 'Com o broker, a escrita não depende de quem consome: um serviço lento ou fora do ar não derruba o lance (ADR-004).',
}

export const ROTEIRO_KAFKA: Roteiro = {
  passos: [
    {
      legenda: 'Três eventos de um mesmo leilão chegam: e1, e2 e e3.',
      nosso: [{ texto: 'partição hash(leilaoId): [e1, e2, e3]' }],
      alternativa: [{ texto: 'fila: [e1, e2, e3]' }],
    },
    {
      legenda: 'Um consumidor lê os três eventos.',
      nosso: [{ texto: 'consumidor A lê e1, e2, e3 (posição 3)', tom: 'ok' }, { texto: 'partição hash(leilaoId): [e1, e2, e3] (continua lá)' }],
      alternativa: [{ texto: 'consumidor A lê e1, e2, e3' }, { texto: 'fila: [ ] (as mensagens somem)', tom: 'aviso' }],
    },
    {
      legenda: 'Um consumidor novo chega (um antifraude, por exemplo).',
      nosso: [{ texto: 'consumidor B lê desde o início: e1, e2, e3', tom: 'ok' }],
      alternativa: [{ texto: 'consumidor B não vê nada: tudo já foi consumido', tom: 'erro' }],
    },
    {
      legenda: 'E a ordem? O leilão inteiro cai na mesma partição.',
      nosso: [{ texto: 'e1, e2, e3 sempre nessa ordem para cada consumidor', tom: 'ok' }],
      alternativa: [{ texto: 'manter a ordem por leilão com vários consumidores exige uma topologia bem mais complexa', tom: 'aviso' }],
    },
  ],
  conclusao: 'O Kafka guarda o log e ordena por leilão. A retenção é limitada: o histórico completo continua no Event Store (ADR-004).',
}
