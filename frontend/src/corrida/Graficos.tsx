import Barras from '../graficos/Barras.tsx'
import Linhas from '../graficos/Linhas.tsx'
import * as S from './series.ts'
import type { Foto } from './tipos.ts'

/** Os gráficos de comparação: atualizam a cada foto e ficam finais depois do `fim`. */
export default function Graficos({ foto }: { foto: Foto | null }) {
  const arqs = foto?.arquiteturas ?? []
  const cores = S.cores(arqs)
  const terminou = foto !== null && !foto.rodando
  return (
    <div className="graficos-corrida">
      <div className="painel grafico-largo">
        <Barras titulo="Tempo para registrar um lance" unidade="em milissegundos (ms), menor é melhor" simbolo="ms" grupos={S.gruposTempos(arqs, 'escrita')} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Tempo para consultar o preço" unidade="em milissegundos (ms), menor é melhor" simbolo="ms" grupos={S.gruposTempos(arqs, 'leitura')} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Lances por segundo" unidade="quantos lances a cada 1 segundo, maior é melhor" simbolo="lances/s" grupos={S.lancesPorSegundo(arqs)} cores={cores} />
      </div>
      <div className="painel grafico-largo">
        <Linhas titulo="Tempo × tamanho do leilão" unidade="milissegundos (ms) por lance, média a cada 10 versões"
          series={S.seriesCurva(arqs)} rotuloX="versão do leilão (lances aceitos)" rotuloY="ms" />
        <p className="suave grafico-nota">Compare a inclinação: quem relê todos os eventos tende a subir conforme o leilão cresce.</p>
      </div>
      <div className="painel">
        <Barras titulo="Operações por lance" unidade="operações no banco + Redis para cada lance, menor é melhor" simbolo="operações/lance" grupos={S.operacoesPorLance(arqs)} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Leituras desatualizadas" unidade="% das consultas, menor é melhor" simbolo="%" grupos={S.desatualizadas(arqs)} cores={cores} />
      </div>
      <div className="painel grafico-largo">
        <Barras titulo="Espaço usado" unidade="quilobytes (KB) no banco ao final, depois de VACUUM nas tabelas da arquitetura" simbolo="KB" grupos={S.espaco(arqs)} cores={cores} />
        {!terminou && <p className="suave grafico-nota">Medido quando a corrida termina.</p>}
        {terminou && <p className="suave grafico-nota">{S.contagemDoEspaco(arqs)}</p>}
      </div>
    </div>
  )
}
