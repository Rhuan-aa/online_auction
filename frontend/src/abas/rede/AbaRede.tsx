import type { EstadoLeilao } from '../../api.ts'
import Barras from '../../graficos/Barras.tsx'
import { limpar, resumoPorRota } from '../../rede.ts'
import Passos from '../../shell/Passos.tsx'
import PorQue from '../../shell/PorQue.tsx'
import Slide from '../../shell/Slide.tsx'
import type { UsuarioId } from '../../usuarios.ts'
import ExperimentoRede from './ExperimentoRede.tsx'
import { useRegistros } from './useRegistros.ts'
import Waterfall from './Waterfall.tsx'

const PORQUE = (
  <p>
    O SSE mantém uma conexão aberta e o servidor empurra o estado logo depois de gravar o evento; o polling pergunta de
    tempos em tempos e paga uma requisição inteira mesmo quando nada mudou (ADR-001).
  </p>
)

interface Props { pergunta: string; passo: number; agora: number; estado: EstadoLeilao | null; incrementoMinimo: number | null; usuario: UsuarioId }

/** Pergunta 3, em 4 passos (secoes.ts): custo por rota, últimas requisições, experimento SSE × polling e "por que". */
export default function AbaRede({ pergunta, passo, agora, estado, incrementoMinimo, usuario }: Props) {
  const [lista, recarregar] = useRegistros()
  const resumo = resumoPorRota(lista)

  return (
    <Passos passo={passo}>
      <Slide
        titulo={pergunta}
        texto={<p>Cada rota que o navegador chamou, com o total de bytes e o tempo médio.</p>}
        acao={(
          <>
            <p className="aviso-fixo">Medimos o corpo das respostas; cabeçalhos HTTP não entram</p>
            <button type="button" className="botao" onClick={() => { limpar(); recarregar() }}>Limpar</button>
          </>
        )}
      >
        {resumo.length === 0
          ? <p className="slide-vazio">Nenhuma requisição medida ainda.</p>
          : (
            <>
              <Barras titulo="Bytes por rota" unidade="bytes" cores={{ bytes: 'var(--serie-a)' }}
                grupos={resumo.map((r) => ({ rotulo: r.rota, valores: [{ serie: 'bytes', valor: r.bytes }] }))} />
              <table className="tabela-rede">
                <thead><tr><th>Rota</th><th>Requisições</th><th>Bytes</th><th>ms médio</th></tr></thead>
                <tbody>
                  {resumo.map((r) => (
                    <tr key={r.rota}><td>{r.rota}</td><td>{r.requisicoes}</td><td>{r.bytes}</td><td>{r.msMedio ? Math.round(r.msMedio) : '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
      </Slide>
      <Slide titulo="As últimas 30 requisições" layout="largo">
        <Waterfall registros={lista} />
      </Slide>
      <ExperimentoRede relogio={agora} estado={estado} incrementoMinimo={incrementoMinimo} usuario={usuario} />
      <PorQue adr="ADR-001">{PORQUE}</PorQue>
    </Passos>
  )
}
