import { useEffect, useState } from 'react'
import { api, ErroHttp, type EstadoLeilao } from '../api.ts'
import { acumularEventos, situacaoDoPalco, type EventoVisto, type SituacaoPalco } from './palco.ts'

export interface Palco {
  estado: EstadoLeilao | null
  eventos: EventoVisto[]
  situacao: SituacaoPalco
  incrementoMinimo: number | null
  precoInicial: number | null
  ultimoEvento: EventoVisto | null
}

interface Dados {
  leilaoId: string
  estado: EstadoLeilao | null
  eventos: EventoVisto[]
  erro: ErroHttp | null
  sseCaiu: boolean
  incrementoMinimo: number | null
  precoInicial: number | null
  ultimoEvento: EventoVisto | null
}

const vazio = (leilaoId: string): Dados => ({
  leilaoId, estado: null, eventos: [], erro: null, sseCaiu: false,
  incrementoMinimo: null, precoInicial: null, ultimoEvento: null,
})

/** "LanceRegistrado.v1" → "LanceRegistrado" */
const semVersao = (tipo: string) => tipo.replace(/\.v\d+$/, '')

/**
 * Leilão em foco: abre o SSE (fecha ao trocar de leilão) e lê os eventos uma vez, para o preço
 * inicial, o incremento mínimo (do LeilaoCriado) e os 5 últimos eventos. O estado guarda o id a
 * que pertence, então ao trocar de leilão os dados do anterior nunca aparecem no novo.
 */
export function usePalco(leilaoId: string | null): Palco {
  const [dados, setDados] = useState<Dados | null>(null)

  useEffect(() => {
    if (!leilaoId) return
    let ativo = true
    const atualizar = (f: (d: Dados) => Dados) =>
      setDados((d) => (ativo ? f(d?.leilaoId === leilaoId ? d : vazio(leilaoId)) : d))

    const parar = api.observarLeilao(
      leilaoId,
      (novo) => {
        const { evento, ...estado } = novo
        atualizar((d) => {
          if (!evento) return { ...d, estado, sseCaiu: false, erro: null }
          const visto = { tipo: semVersao(evento.tipo), versao: evento.versao, quando: Date.now() }
          return { ...d, estado, sseCaiu: false, erro: null, eventos: acumularEventos(d.eventos, visto), ultimoEvento: visto }
        })
      },
      () => atualizar((d) => ({ ...d, sseCaiu: true })),
    )

    // O SSE fica mudo se o leilão não existe ou o serviço está fora: uma consulta avisa e, se
    // falhar por outro motivo que não 404, repete a cada 3 s até conseguir. O último estado fica.
    const parar404 = () => clearInterval(timer)
    const tentar = () => api.consultarLeilao(leilaoId).then((e) => {
      atualizar((d) => ({ ...d, estado: d.estado ?? e, erro: null }))
      parar404()
    }).catch((e) => {
      const erro = e instanceof ErroHttp ? e : new ErroHttp(0, 'Sem conexão com o servidor')
      atualizar((d) => ({ ...d, erro }))
      if (erro.status === 404) parar404()
    })
    const timer = setInterval(tentar, 3000)
    tentar()

    api.eventos(leilaoId).then((lista) => {
      const criado = lista.find((e) => e.tipo.startsWith('LeilaoCriado'))?.dados as
        { precoInicial?: number; incrementoMinimo?: number } | undefined
      const recentes = lista.slice(-5).map((e) => ({ tipo: semVersao(e.tipo), versao: e.versao, quando: Date.parse(e.criadoEm) }))
      atualizar((d) => {
        // o histórico é mais antigo que o que já chegou pelo SSE: entra por baixo e só completa o feed
        const feed = [...d.eventos]
        for (const v of recentes.reverse()) if (feed.length < 5 && !feed.some((e) => e.versao === v.versao)) feed.push(v)
        return {
          ...d, eventos: feed.sort((a, b) => b.versao - a.versao),
          incrementoMinimo: criado?.incrementoMinimo ?? d.incrementoMinimo,
          precoInicial: criado?.precoInicial ?? d.precoInicial,
        }
      })
    }).catch(() => { /* sem histórico: o palco funciona, só sem os 5 últimos eventos */ })

    return () => { ativo = false; clearInterval(timer); parar() }
  }, [leilaoId])

  const d = leilaoId && dados?.leilaoId === leilaoId ? dados : null
  const atual = d ?? (leilaoId ? vazio(leilaoId) : null)
  return {
    estado: atual?.estado ?? null,
    eventos: atual?.eventos ?? [],
    situacao: situacaoDoPalco({ leilaoId, estado: atual?.estado ?? null, erro: atual?.erro ?? null, sseCaiu: atual?.sseCaiu ?? false }),
    incrementoMinimo: atual?.incrementoMinimo ?? null,
    precoInicial: atual?.precoInicial ?? null,
    ultimoEvento: atual?.ultimoEvento ?? null,
  }
}
