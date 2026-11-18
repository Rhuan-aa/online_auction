import Barras from '../../graficos/Barras.tsx'
import BarrasEmpilhadas from '../../graficos/BarrasEmpilhadas.tsx'
import Linhas from '../../graficos/Linhas.tsx'
import type { Comparacao } from './comparacao.ts'
import { CORES, dadosComparacao } from './dadosComparacao.ts'

function Faltando({ comparacao }: { comparacao: Comparacao }) {
  const faltando = (['A', 'B', 'C'] as const).filter((c) => !comparacao.execucoes[c])
  if (faltando.length === 0) return null
  return <p className="suave" role="status">Sem dados (—) para: {faltando.join(', ')}. A comparação foi interrompida.</p>
}

/** Passo "Resultado": percentis da escrita e da leitura. */
export function GraficosResultado({ comparacao }: { comparacao: Comparacao }) {
  const d = dadosComparacao(comparacao)
  return (
    <>
      <Faltando comparacao={comparacao} />
      <div className="graficos-grade">
        <Barras titulo="Escrita: tempo no navegador por percentil" unidade="ms" grupos={d.percentis.escrita} cores={CORES} />
        <Barras titulo="Leitura: tempo no navegador por percentil" unidade="ms" grupos={d.percentis.leitura} cores={CORES} />
      </div>
    </>
  )
}

/** Passo "Por dentro do cache": tempo no backend, eventos lidos, acerto e origem do estado. */
export function GraficosCache({ comparacao }: { comparacao: Comparacao }) {
  const d = dadosComparacao(comparacao)
  return (
    <>
      <Faltando comparacao={comparacao} />
      <div className="graficos-grade">
        <Barras titulo="Tempo médio de obter o estado no backend" unidade="ms" grupos={d.tempoMedio} cores={CORES} />
        <Barras titulo="Eventos lidos por obtenção" unidade="eventos" grupos={d.eventos} cores={CORES} />
        <Barras titulo="Acerto do cache" unidade="%" grupos={d.acerto} cores={CORES} />
        <BarrasEmpilhadas titulo="De onde veio o estado (obtenções por origem)" unidade="obtenções" itens={d.origem} />
      </div>
    </>
  )
}

/** Curva do passo "Tempo × versão". */
export function GraficoCurva({ comparacao }: { comparacao: Comparacao }) {
  const d = dadosComparacao(comparacao)
  return (
    <>
      <Faltando comparacao={comparacao} />
      <Linhas titulo="Escrita: tempo × versão do leilão" unidade="ms" series={d.curva} rotuloX="versão (nº de eventos)" rotuloY="ms (mediana)" />
    </>
  )
}
