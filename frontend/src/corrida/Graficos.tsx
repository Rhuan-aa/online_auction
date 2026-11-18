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
        <Barras titulo="Tempo para registrar um lance" unidade="ms, menor é melhor" grupos={S.gruposTempos(arqs, 'escrita')} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Tempo para consultar o preço" unidade="ms, menor é melhor" grupos={S.gruposTempos(arqs, 'leitura')} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Lances por segundo" unidade="maior é melhor" grupos={S.lancesPorSegundo(arqs)} cores={cores} />
      </div>
      <div className="painel grafico-largo">
        <Linhas titulo="Tempo × tamanho do leilão" unidade="ms por lance, média a cada 10 versões"
          series={S.seriesCurva(arqs)} rotuloX="versão do leilão (lances aceitos)" rotuloY="ms" />
        <p className="suave grafico-nota">Compare a inclinação: quem relê todos os eventos tende a subir conforme o leilão cresce.</p>
      </div>
      <div className="painel">
        <Barras titulo="Operações por lance" unidade="banco + Redis, menor é melhor" grupos={S.operacoesPorLance(arqs)} cores={cores} />
      </div>
      <div className="painel">
        <Barras titulo="Leituras desatualizadas" unidade="% das consultas" grupos={S.desatualizadas(arqs)} cores={cores} />
      </div>
      <div className="painel grafico-largo">
        <Barras titulo="Espaço usado" unidade="KB no banco ao final, depois de VACUUM nas tabelas da arquitetura" grupos={S.espaco(arqs)} cores={cores} />
        {!terminou && <p className="suave grafico-nota">Medido quando a corrida termina.</p>}
        {terminou && <p className="suave grafico-nota">{S.contagemDoEspaco(arqs)}</p>}
      </div>
    </div>
  )
}
