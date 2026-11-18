import type { EstadoLeilao } from '../../api.ts'
import Barras from '../../graficos/Barras.tsx'
import { limpar, resumoPorRota } from '../../rede.ts'
import Aba from '../../shell/Aba.tsx'
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

interface Props { pergunta: string; estado: EstadoLeilao | null; incrementoMinimo: number; usuario: UsuarioId }

export default function AbaRede({ pergunta, estado, incrementoMinimo, usuario }: Props) {
  const [lista, recarregar] = useRegistros()
  const resumo = resumoPorRota(lista)

  return (
    <Aba pergunta={pergunta} adr="ADR-001" porQue={PORQUE}>
      <p className="aviso-fixo">Medimos o corpo das respostas; cabeçalhos HTTP não entram</p>

      <section className="bloco-aba">
        <h2>Por rota</h2>
        <div><button type="button" onClick={() => { limpar(); recarregar() }}>Limpar</button></div>
        {resumo.length === 0
          ? <p className="suave">Nenhuma requisição medida ainda.</p>
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
      </section>

      <section className="bloco-aba">
        <h2>Últimas 30 requisições</h2>
        <Waterfall registros={lista} />
      </section>

      <ExperimentoRede estado={estado} incrementoMinimo={incrementoMinimo} usuario={usuario} />
    </Aba>
  )
}
