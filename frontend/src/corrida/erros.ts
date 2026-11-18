import { ErroHttp, FORA_DO_AR } from '../api.ts'

/** Mensagem para a tela a partir de um erro do serviço de corrida. */
export function mensagemDeErro(e: unknown): string {
  if (!(e instanceof ErroHttp)) return e instanceof Error ? e.message : String(e)
  if (e.status === 0) return FORA_DO_AR
  if (e.status === 409) return `Já existe uma corrida em andamento: espere ela terminar e tente de novo. (${e.message})`
  if (e.status === 400) return `O serviço recusou os parâmetros: ${e.message}`
  return `O serviço de corrida respondeu ${e.status}: ${e.message}`
}
