import Formulario from './corrida/Formulario.tsx'
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
      </main>
    </>
  )
}
