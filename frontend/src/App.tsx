import Formulario from './corrida/Formulario.tsx'
import Graficos from './corrida/Graficos.tsx'
import Placar from './corrida/Placar.tsx'
import Raias, { ResumoCorrida } from './corrida/Raias.tsx'
import { SELO } from './corrida/tipos.ts'
import { useCorrida } from './corrida/useCorrida.ts'
import Secao from './Secao.tsx'
import Topo from './Topo.tsx'

export default function App() {
  const corrida = useCorrida()
  const rodando = corrida.fase === 'rodando' || corrida.fase === 'parando'

  return (
    <>
      <Topo />
      <main className="pagina">
        <Secao id="simulacao" kicker="1 · Simulação" titulo="O mesmo leilão, em 6 arquiteturas ao mesmo tempo"
          explicacao="Escolha a carga: as 6 arquiteturas partem do mesmo estado e recebem a mesma sequência de lances.">
          <Formulario rodando={rodando} ocupado={corrida.fase === 'iniciando' || corrida.fase === 'parando'}
            erro={corrida.erro} aoIniciar={corrida.iniciar} aoParar={corrida.parar} />
        </Secao>

        <Secao id="corrida" kicker="2 · Corrida ao vivo" titulo="Quem registra os lances mais rápido?"
          explicacao="Cada raia é uma arquitetura de verdade, gravando no próprio banco; os números chegam do servidor 4 vezes por segundo.">
          <div className="corrida-topo">
            <ResumoCorrida foto={corrida.foto} />
            <span className="selo-medido">{SELO}</span>
          </div>
          {(corrida.aviso || corrida.erro) && (
            <div className="corrida-alertas">
              {corrida.erro && <p className="alerta">{corrida.erro}</p>}
              {corrida.aviso && <p className="alerta alerta--aviso" role="status">{corrida.aviso}</p>}
            </div>
          )}
          <Raias foto={corrida.foto} fase={corrida.fase} />
        </Secao>

        <Secao id="comparacao" kicker="3 · Comparação" titulo="Onde cada arquitetura ganha e perde"
          explicacao="Os mesmos números das raias, lado a lado; cada cor é sempre a mesma arquitetura.">
          <Graficos foto={corrida.foto} />
        </Secao>

        <Secao id="placar" kicker="4 · Placar" titulo="E o vencedor é…"
          explicacao="O melhor valor de cada critério fica destacado com ★; integridade diz se o resultado final está certo.">
          <div className="placar-topo"><span className="selo-medido">{SELO}</span></div>
          <Placar foto={corrida.foto} />
        </Secao>
      </main>
    </>
  )
}
