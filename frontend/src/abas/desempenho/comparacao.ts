// Comparação A × B × C: roda a mesma simulação nas três configurações de cache, em sequência e sem
// reiniciar nada (a troca é a rota /admin/cache/configuracao dos dois serviços), e sempre devolve
// os serviços à configuração em que estavam.
import type { Api, ConfiguracaoCache } from '../../api.ts'
import { ErroSimulacao, executar, lerConfiguracaoAtiva, type Execucao, type Parametros, type Progresso } from '../../simulacao.ts'

export interface Comparacao {
  id: string
  quando: string
  parametros: Parametros
  execucoes: Partial<Record<ConfiguracaoCache, Execucao>>
  completa: boolean
  /** Não foi possível devolver um dos serviços à configuração anterior: avisar o usuário. */
  restauracaoFalhou?: boolean
}

export interface AndamentoComparacao {
  configuracao: ConfiguracaoCache
  progresso: Progresso
  feitas: ConfiguracaoCache[]
}

const ORDEM: ConfiguracaoCache[] = ['A', 'B', 'C']
const SERVICOS = ['escrita', 'leitura'] as const

async function trocarDois(api: Api, c: ConfiguracaoCache): Promise<void> {
  for (const s of SERVICOS) await api.trocarConfiguracaoCache(s, c)
}

/** `executarFn` só existe para os testes substituírem a simulação real. */
export async function compararABC(
  api: Api, p: Parametros, aoProgredir: (a: AndamentoComparacao) => void, sinal: AbortSignal,
  executarFn: typeof executar = executar,
): Promise<Comparacao> {
  const anterior = await lerConfiguracaoAtiva(api)
  const execucoes: Comparacao['execucoes'] = {}
  const feitas: ConfiguracaoCache[] = []
  let restauracaoFalhou = false
  try {
    for (const cfg of ORDEM) {
      if (sinal.aborted) break
      await trocarDois(api, cfg)
      for (const s of SERVICOS) {
        if ((await api.lerConfiguracaoCache(s)) !== cfg) throw new ErroSimulacao(`Não foi possível trocar para ${cfg}`)
      }
      try {
        execucoes[cfg] = await executarFn(api, p, cfg, (progresso) => aoProgredir({ configuracao: cfg, progresso, feitas: [...feitas] }), sinal)
      } catch (err) {
        if (sinal.aborted) break // interrompida pelo usuário (qualquer erro vindo do fetch cancelado): devolve o que já rodou
        throw err
      }
      feitas.push(cfg)
    }
  } finally {
    for (const s of SERVICOS) {
      try {
        await api.trocarConfiguracaoCache(s, anterior)
      } catch (err) {
        restauracaoFalhou = true
        console.error(`Não foi possível restaurar a configuração ${anterior} na ${s}`, err)
      }
    }
  }
  return {
    id: `${Date.now()}`,
    quando: new Date().toISOString(),
    parametros: p,
    execucoes,
    completa: ORDEM.every((c) => execucoes[c]),
    ...(restauracaoFalhou && { restauracaoFalhou }),
  }
}
