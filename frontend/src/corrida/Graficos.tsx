import Barras from '../graficos/Barras.tsx'
import Linhas from '../graficos/Linhas.tsx'
import * as T from './leituras.ts'
import { bytes, convertido, ms, pct, porLanceOps, porSegundo } from './medidas.ts'
import * as S from './series.ts'
import type { Foto } from './tipos.ts'

const emSegundos = (v: number) => {
  const c = convertido(v)
  return c ? `= ${c}` : null
}
const intervalo = (v: number) => (v > 0 ? `em média, 1 lance concluído a cada ${ms(1000 / v)} (todos os licitantes simultâneos juntos)` : null)

/**
 * Os gráficos de comparação: atualizam a cada foto e ficam finais depois do `fim`. Passar o mouse numa
 * barra mostra o valor, a posição e a distância até o melhor; a caixa embaixo diz o que o gráfico mostra.
 */
export default function Graficos({ foto }: { foto: Foto | null }) {
  const arqs = foto?.arquiteturas ?? []
  const cores = S.cores(arqs)
  const terminou = foto !== null && !foto.rodando
  return (
    <div className="graficos-corrida">
      <p className="suave graficos-dica">Passe o mouse (ou use Tab) nas barras para ver o valor exato e a posição; clique numa arquitetura da legenda para destacá-la.</p>
      <div className="painel grafico-largo">
        <Barras titulo="Tempo para registrar um lance" unidade="em milissegundos (ms), menor é melhor" simbolo="ms" sentido="menor"
          formatar={ms} extra={emSegundos} grupos={S.gruposTempos(arqs, 'escrita')} cores={cores} leitura={T.leituraEscrita(arqs)} />
      </div>
      <div className="painel">
        <Barras titulo="Tempo para consultar o preço" unidade="em milissegundos (ms), menor é melhor" simbolo="ms" sentido="menor"
          formatar={ms} extra={emSegundos} grupos={S.gruposTempos(arqs, 'leitura')} cores={cores} leitura={T.leituraConsulta(arqs)} />
      </div>
      <div className="painel">
        <Barras titulo="Lances por segundo" unidade="quantos lances a cada 1 segundo, maior é melhor" simbolo="lances/s" sentido="maior"
          formatar={porSegundo} extra={intervalo} grupos={S.lancesPorSegundo(arqs)} cores={cores} leitura={T.leituraVazao(arqs)} />
      </div>
      <div className="painel grafico-largo">
        <Linhas titulo="Tempo × tamanho do leilão" unidade="milissegundos (ms) por lance, média a cada 10 versões"
          series={S.seriesCurva(arqs)} rotuloX="versão do leilão (lances aceitos)" rotuloY="ms" formatar={ms} leitura={T.leituraCurva(arqs)} />
      </div>
      <div className="painel">
        <Barras titulo="Operações por lance" unidade="operações no banco + Redis para cada lance, menor é melhor" simbolo="op/lance" sentido="menor"
          formatar={porLanceOps} grupos={S.operacoesPorLance(arqs)} cores={cores} leitura={T.leituraOperacoes(arqs)} />
      </div>
      <div className="painel">
        <Barras titulo="Leituras desatualizadas" unidade="% das consultas, menor é melhor" simbolo="%" sentido="menor"
          formatar={pct} grupos={S.desatualizadas(arqs)} cores={cores} leitura={T.leituraDesatualizadas(arqs)} />
      </div>
      <div className="painel grafico-largo">
        <Barras titulo="Espaço usado" unidade="quilobytes (KB) no banco ao final, depois de VACUUM nas tabelas da arquitetura" simbolo="KB" sentido="menor"
          formatar={(v) => bytes(v * 1024)} grupos={S.espaco(arqs)} cores={cores} leitura={T.leituraEspaco(arqs)} />
        {!terminou && <p className="suave grafico-nota">Medido quando a corrida termina.</p>}
        {terminou && <p className="suave grafico-nota">{S.contagemDoEspaco(arqs)}</p>}
      </div>
    </div>
  )
}
