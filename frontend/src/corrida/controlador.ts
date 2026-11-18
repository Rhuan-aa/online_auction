// A lógica da corrida no navegador, sem React: POST /corrida, o SSE dela, parar e recuperar o resultado.
// useCorrida só liga isto ao React (useSyncExternalStore); assim dá para testar com uma api falsa.
import { ErroHttp, FORA_DO_AR, type Api } from '../api.ts'
import { mensagemDeErro } from './erros.ts'
import type { Foto, Parametros } from './tipos.ts'

/** ociosa: nada rodando (nunca rodou, falhou ou perdeu a conexão); terminou: chegou o evento `fim`. */
export type Fase = 'ociosa' | 'iniciando' | 'rodando' | 'parando' | 'terminou'

export interface Estado {
  fase: Fase
  foto: Foto | null // a última foto; depois do `fim`, o resultado
  erro: string | null
  aviso: string | null // conexão instável, mas o navegador ainda tenta
  emAndamento: string | null // 409: id da corrida que já está rodando (dá para acompanhar ou parar)
}

export type ApiCorrida = Pick<Api, 'iniciarCorrida' | 'pararCorrida' | 'consultarCorrida' | 'observarCorrida'>

const PERDEU = 'A conexão com o serviço de corrida (8085) caiu antes do fim; os números abaixo são os últimos recebidos.'
const INSTAVEL = 'Conexão com o serviço de corrida instável; tentando reconectar…'
const INICIAL: Estado = { fase: 'ociosa', foto: null, erro: null, aviso: null, emAndamento: null }

/** Uma corrida por vez. Eventos de uma corrida antiga nunca mexem no estado da atual. */
export class ControladorCorrida {
  private estado: Estado = INICIAL
  private readonly ouvintes = new Set<() => void>()
  private atual: { id: string; fechar: () => void } | null = null
  private ativo = true

  private readonly api: ApiCorrida

  constructor(api: ApiCorrida) { this.api = api }

  /** Para o useSyncExternalStore. */
  estadoAtual = () => this.estado
  assinar = (f: () => void) => {
    this.ouvintes.add(f)
    return () => { this.ouvintes.delete(f) }
  }

  montar() { this.ativo = true }
  descartar() { this.ativo = false; this.encerrar() }

  private mudar(f: (s: Estado) => Estado) {
    this.estado = f(this.estado)
    this.ouvintes.forEach((o) => o())
  }

  private encerrar() { this.atual?.fechar(); this.atual = null }

  async iniciar(p: Parametros) {
    this.encerrar()
    this.mudar(() => ({ ...INICIAL, fase: 'iniciando' }))
    let id: string
    try {
      id = (await this.api.iniciarCorrida(p)).corridaId
    } catch (e) {
      if (!this.ativo) return
      const emAndamento = e instanceof ErroHttp && e.status === 409 ? e.corridaId ?? null : null
      this.mudar(() => ({ ...INICIAL, erro: mensagemDeErro(e), emAndamento }))
      return
    }
    if (this.ativo) this.assistir(id)
  }

  /** Liga-se ao stream de uma corrida (a nossa, ou a que o 409 disse que já roda). */
  private assistir(id: string) {
    this.encerrar()
    // só a corrida atual mexe no estado (checado na hora do evento, não depois)
    const daVez = (f: (s: Estado) => Estado) => { if (this.atual?.id === id) this.mudar(f) }
    const daVezEncerrar = () => { if (this.atual?.id === id) this.encerrar() }
    const terminar = (foto: Foto) => {
      daVez((s) => ({ ...s, foto, aviso: null, fase: 'terminou' }))
      daVezEncerrar() // um `fim` velho nunca fecha o stream da corrida atual
    }
    const fechar = this.api.observarCorrida(id, {
      aoFoto: (foto) => daVez((s) => ({ ...s, foto, aviso: null, fase: s.fase === 'parando' ? 'parando' : 'rodando' })),
      aoFim: terminar,
      aoFalhar: (fechado) => {
        if (fechado) {
          daVez((s) => ({ ...s, fase: 'ociosa', aviso: null, erro: s.foto ? PERDEU : FORA_DO_AR }))
          daVezEncerrar()
          return
        }
        daVez((s) => ({ ...s, aviso: INSTAVEL }))
        // o stream pode ter caído depois do fim: o último estado diz se a corrida já acabou
        this.api.consultarCorrida(id).then((f) => { if (!f.rodando) terminar(f) }).catch(() => { /* segue tentando */ })
      },
    })
    this.atual = { id, fechar }
    this.mudar((s) => ({ ...s, fase: 'rodando', erro: null, emAndamento: null }))
  }

  /** Depois de um 409: assiste à corrida que já estava rodando. */
  acompanhar() {
    const id = this.estado.emAndamento
    if (id) this.assistir(id)
  }

  /** Depois de um 409: para a corrida que já estava rodando (e a acompanha até o `fim`). */
  pararEmAndamento() {
    this.acompanhar()
    return this.parar()
  }

  async parar() {
    const id = this.atual?.id
    if (!id) return
    this.mudar((s) => ({ ...s, fase: 'parando', erro: null }))
    try {
      await this.api.pararCorrida(id) // o `fim` chega pelo SSE
    } catch (e) {
      if (this.atual?.id !== id) return
      const perdida = e instanceof ErroHttp && (e.status === 0 || e.status === 404)
      if (perdida) this.encerrar()
      this.mudar((s) => ({ ...s, fase: perdida ? 'ociosa' : 'rodando', erro: mensagemDeErro(e) }))
    }
  }
}
