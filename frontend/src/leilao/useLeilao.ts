import { useEffect, useState } from 'react'
import { api, ErroHttp, type EstadoLeilao } from '../api.ts'
import { situacaoDoLeilao, type EventoVisto, type Situacao } from './regras.ts'

export interface Leilao {
  estado: EstadoLeilao | null
  situacao: Situacao
  incrementoMinimo: number | null
  precoInicial: number | null
  ultimoEvento: EventoVisto | null
}

interface Dados {
  leilaoId: string
  estado: EstadoLeilao | null
  erro: ErroHttp | null
  sseCaiu: boolean
  incrementoMinimo: number | null
  precoInicial: number | null
  ultimoEvento: EventoVisto | null
}

const vazio = (leilaoId: string): Dados => ({
  leilaoId, estado: null, erro: null, sseCaiu: false, incrementoMinimo: null, precoInicial: null, ultimoEvento: null,
})

/** "LanceRegistrado.v1" → "LanceRegistrado" */
const semVersao = (tipo: string) => tipo.replace(/\.v\d+$/, '')

/**
 * O leilão de demonstração: uma única assinatura SSE (fechada ao trocar de leilão) e uma leitura dos eventos,
 * para o preço inicial e o incremento mínimo (do LeilaoCriado). O estado guarda o id a que pertence,
 * então ao trocar de leilão os dados do anterior nunca aparecem no novo.
 */
export function useLeilao(leilaoId: string | null): Leilao {
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
          return { ...d, estado, sseCaiu: false, erro: null, ultimoEvento: visto }
        })
      },
      () => atualizar((d) => ({ ...d, sseCaiu: true })),
    )

    // O SSE fica mudo se o leilão não existe ou o serviço está fora: uma consulta avisa e, se
    // falhar por outro motivo que não 4xx, repete a cada 3 s até conseguir. O último estado fica.
    const pararTentativas = () => clearInterval(timer)
    const tentar = () => api.consultarLeilao(leilaoId).then((e) => {
      atualizar((d) => ({ ...d, estado: d.estado ?? e, erro: null }))
      pararTentativas()
    }).catch((e) => {
      const erro = e instanceof ErroHttp ? e : new ErroHttp(0, 'Sem conexão com o servidor')
      atualizar((d) => ({ ...d, erro }))
      if (erro.status >= 400 && erro.status < 500) pararTentativas()
    })
    const timer = setInterval(tentar, 3000)
    tentar()

    api.eventos(leilaoId).then((lista) => {
      const criado = lista.find((e) => e.tipo.startsWith('LeilaoCriado'))?.dados as
        { precoInicial?: number; incrementoMinimo?: number } | undefined
      atualizar((d) => ({
        ...d,
        incrementoMinimo: criado?.incrementoMinimo ?? d.incrementoMinimo,
        precoInicial: criado?.precoInicial ?? d.precoInicial,
      }))
    }).catch(() => { /* sem histórico: o primeiro lance fica sem valor sugerido */ })

    return () => { ativo = false; clearInterval(timer); parar() }
  }, [leilaoId])

  const d = leilaoId && dados?.leilaoId === leilaoId ? dados : null
  return {
    estado: d?.estado ?? null,
    situacao: situacaoDoLeilao({ leilaoId, estado: d?.estado ?? null, erro: d?.erro ?? null, sseCaiu: d?.sseCaiu ?? false }),
    incrementoMinimo: d?.incrementoMinimo ?? null,
    precoInicial: d?.precoInicial ?? null,
    ultimoEvento: d?.ultimoEvento ?? null,
  }
}
