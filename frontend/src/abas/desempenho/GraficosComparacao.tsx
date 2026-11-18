import Barras from '../../graficos/Barras.tsx'
import BarrasEmpilhadas from '../../graficos/BarrasEmpilhadas.tsx'
import Linhas from '../../graficos/Linhas.tsx'
import type { Comparacao } from './comparacao.ts'
import { CORES, dadosComparacao } from './dadosComparacao.ts'

export default function GraficosComparacao({ comparacao }: { comparacao: Comparacao }) {
  const d = dadosComparacao(comparacao)
  const faltando = (['A', 'B', 'C'] as const).filter((c) => !comparacao.execucoes[c])
  return (
    <>
      {faltando.length > 0 && (
        <p className="suave" role="status">Sem dados (—) para: {faltando.join(', ')}. A comparação foi interrompida.</p>
      )}
      <div className="graficos-comparacao">
        <Barras titulo="Escrita: tempo no navegador por percentil" unidade="ms" grupos={d.percentis.escrita} cores={CORES} />
        <Barras titulo="Leitura: tempo no navegador por percentil" unidade="ms" grupos={d.percentis.leitura} cores={CORES} />
        <Barras titulo="Tempo médio de obter o estado no backend" unidade="ms" grupos={d.tempoMedio} cores={CORES} />
        <Barras titulo="Eventos lidos por obtenção" unidade="eventos" grupos={d.eventos} cores={CORES} />
        <Barras titulo="Acerto do cache" unidade="%" grupos={d.acerto} cores={CORES} />
        <BarrasEmpilhadas titulo="De onde veio o estado (obtenções por origem)" unidade="obtenções" itens={d.origem} />
        <Linhas titulo="Escrita: tempo × versão do leilão" unidade="ms" series={d.curva} rotuloX="versão (nº de eventos)" rotuloY="ms (mediana)" />
      </div>
    </>
  )
}
