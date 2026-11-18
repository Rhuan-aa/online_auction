// Formulário da simulação completa (compartilhado pelas abas Integridade e Desempenho e pelo painel de ADM).
import { paraCentavos } from '../../formato.ts'
import type { Parametros } from '../../simulacao.ts'

export const MAX_CONEXOES = 6
/** O SSE do palco já ocupa 1 das ~6 conexões do navegador com a leitura (8082): sobram 5 para os leitores. */
export const MAX_LEITORES = MAX_CONEXOES - 1

export interface Campos {
  licitantes: string; lancesPorLicitante: string; simultaneos: string
  precoInicial: string; incrementoMin: string; incrementoMax: string
  leitores: string; semente: string
  acompanharPreco: boolean
}

export const PADRAO: Campos = {
  licitantes: '20', lancesPorLicitante: '10', simultaneos: '6',
  precoInicial: '100,00', incrementoMin: '1,00', incrementoMax: '50,00',
  leitores: '4', semente: '42', acompanharPreco: true,
}

/** Campos → parâmetros; devolve a mensagem de erro se algum for inválido. */
export function validar(c: Campos): Parametros | string {
  const inteiro = (texto: string, nome: string, min: number, max: number): number | string => {
    const n = Number(texto)
    return Number.isInteger(n) && n >= min && n <= max ? n : `${nome}: informe um inteiro de ${min} a ${max}.`
  }
  const licitantes = inteiro(c.licitantes, 'Licitantes', 1, 200)
  const lances = inteiro(c.lancesPorLicitante, 'Lances por licitante', 1, 500)
  const simultaneos = inteiro(c.simultaneos, 'Lances simultâneos', 1, MAX_CONEXOES)
  const leitores = inteiro(c.leitores, 'Leitores', 1, MAX_LEITORES)
  const semente = inteiro(c.semente, 'Semente', 0, 2 ** 31 - 1)
  for (const v of [licitantes, lances, simultaneos, leitores, semente]) if (typeof v === 'string') return v
  const preco = paraCentavos(c.precoInicial)
  const incMin = paraCentavos(c.incrementoMin)
  const incMax = paraCentavos(c.incrementoMax)
  if (preco === null) return 'Informe um preço inicial maior que zero.'
  if (incMin === null || incMax === null) return 'Informe a faixa de incremento com valores maiores que zero.'
  if (incMax < incMin) return 'O fim da faixa de incremento precisa ser maior ou igual ao início.'
  return {
    licitantes: licitantes as number, lancesPorLicitante: lances as number, simultaneos: simultaneos as number,
    precoInicial: preco, incrementoMin: incMin, incrementoMax: incMax,
    leitores: leitores as number, semente: semente as number, acompanharPreco: c.acompanharPreco,
  }
}

interface Props { valor: Campos; onChange: (c: Campos) => void; desabilitado: boolean }

/** Só os campos, dentro de um <fieldset>; o <form> e os botões ficam com quem usa. */
export default function FormSimulacao({ valor, onChange, desabilitado }: Props) {
  const mudar = (campo: Exclude<keyof Campos, 'acompanharPreco'>) => (e: { target: { value: string } }) =>
    onChange({ ...valor, [campo]: e.target.value })
  return (
    <fieldset disabled={desabilitado}>
      <label>Licitantes<input inputMode="numeric" value={valor.licitantes} onChange={mudar('licitantes')} /></label>
      <label>Lances por licitante<input inputMode="numeric" value={valor.lancesPorLicitante} onChange={mudar('lancesPorLicitante')} /></label>
      <label>Lances simultâneos (1–{MAX_CONEXOES})<input inputMode="numeric" value={valor.simultaneos} onChange={mudar('simultaneos')} /></label>
      <label>Leitores (1–{MAX_LEITORES})<input inputMode="numeric" value={valor.leitores} onChange={mudar('leitores')} /></label>
      <label>Preço inicial (R$)<input inputMode="decimal" value={valor.precoInicial} onChange={mudar('precoInicial')} /></label>
      <label>Incremento de (R$)<input inputMode="decimal" value={valor.incrementoMin} onChange={mudar('incrementoMin')} /></label>
      <label>até (R$)<input inputMode="decimal" value={valor.incrementoMax} onChange={mudar('incrementoMax')} /></label>
      <label>Semente<input inputMode="numeric" value={valor.semente} onChange={mudar('semente')} /></label>
      <label className="opcao" title="Envia o maior entre o valor planejado e o último preço conhecido + incremento mínimo. Desligado, quase todo lance é recusado e o leilão fica curto.">
        <input type="checkbox" checked={valor.acompanharPreco}
          onChange={(e) => onChange({ ...valor, acompanharPreco: e.target.checked })} />
        Lance acompanha o preço (leilão longo)
      </label>
    </fieldset>
  )
}
