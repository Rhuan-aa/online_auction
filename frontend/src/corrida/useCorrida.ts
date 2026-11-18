import { useEffect, useRef, useState } from 'react'
import { api, ErroHttp, FORA_DO_AR } from '../api.ts'
import { mensagemDeErro } from './erros.ts'
import type { Foto, Parametros } from './tipos.ts'

/** ociosa: nada rodando (nunca rodou, falhou ou perdeu a conexão); terminou: chegou o evento `fim`. */
export type Fase = 'ociosa' | 'iniciando' | 'rodando' | 'parando' | 'terminou'

export interface Corrida {
  fase: Fase
  foto: Foto | null // a última foto; depois do `fim`, o resultado
  erro: string | null
  aviso: string | null // conexão instável, mas o navegador ainda tenta
  iniciar: (p: Parametros) => void
  parar: () => void
}

interface Estado { fase: Fase; foto: Foto | null; erro: string | null; aviso: string | null }

const PERDEU = 'A conexão com o serviço de corrida (8085) caiu antes do fim; os números abaixo são os últimos recebidos.'

/**
 * Uma corrida por vez: POST /corrida e o SSE dela. O EventSource é fechado no `fim`, ao desmontar e ao
 * iniciar outra corrida. Eventos de uma corrida antiga nunca mexem no estado da atual.
 */
export function useCorrida(): Corrida {
  const [s, setS] = useState<Estado>({ fase: 'ociosa', foto: null, erro: null, aviso: null })
  const atual = useRef<{ id: string; fechar: () => void } | null>(null)
  const montado = useRef(false)

  const encerrar = () => { atual.current?.fechar(); atual.current = null }

  useEffect(() => {
    montado.current = true
    return () => { montado.current = false; encerrar() }
  }, [])

  async function iniciar(p: Parametros) {
    encerrar()
    setS({ fase: 'iniciando', foto: null, erro: null, aviso: null })
    let id: string
    try {
      id = (await api.iniciarCorrida(p)).corridaId
    } catch (e) {
      if (montado.current) setS({ fase: 'ociosa', foto: null, erro: mensagemDeErro(e), aviso: null })
      return
    }
    if (!montado.current) return
    // só a corrida atual mexe no estado (checado na hora do evento, não depois)
    const daVez = (f: (s: Estado) => Estado) => { if (atual.current?.id === id) setS(f) }
    const terminar = (foto: Foto) => { daVez((s) => ({ ...s, foto, aviso: null, fase: 'terminou' })); encerrar() }
    const fechar = api.observarCorrida(id, {
      aoFoto: (foto) => daVez((s) => ({ ...s, foto, aviso: null, fase: s.fase === 'parando' ? 'parando' : 'rodando' })),
      aoFim: terminar,
      aoFalhar: (fechado) => {
        if (fechado) {
          daVez((s) => ({ ...s, fase: 'ociosa', aviso: null, erro: s.foto ? PERDEU : FORA_DO_AR }))
          encerrar()
          return
        }
        daVez((s) => ({ ...s, aviso: 'Conexão com o serviço de corrida instável; tentando reconectar…' }))
        // o stream pode ter caído depois do fim: o último estado diz se a corrida já acabou
        api.consultarCorrida(id).then((f) => { if (!f.rodando) terminar(f) }).catch(() => { /* segue tentando */ })
      },
    })
    atual.current = { id, fechar }
    setS((s) => ({ ...s, fase: 'rodando' }))
  }

  async function parar() {
    const id = atual.current?.id
    if (!id) return
    setS((s) => ({ ...s, fase: 'parando', erro: null }))
    try {
      await api.pararCorrida(id) // o `fim` chega pelo SSE
    } catch (e) {
      if (atual.current?.id !== id) return
      const perdida = e instanceof ErroHttp && (e.status === 0 || e.status === 404)
      if (perdida) encerrar()
      setS((s) => ({ ...s, fase: perdida ? 'ociosa' : 'rodando', erro: mensagemDeErro(e) }))
    }
  }

  return { ...s, iniciar: (p) => void iniciar(p), parar: () => void parar() }
}
