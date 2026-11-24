import SecaoCaminho from './caminho/SecaoCaminho.tsx'
import Formulario from './corrida/Formulario.tsx'
import Graficos from './corrida/Graficos.tsx'
import Placar from './corrida/Placar.tsx'
import Raias, { ResumoCorrida } from './corrida/Raias.tsx'
import { RESSALVAS, SELO } from './corrida/tipos.ts'
import { useCorrida } from './corrida/useCorrida.ts'
import SeletorLeilao from './leilao/SeletorLeilao.tsx'
import { useLeilao } from './leilao/useLeilao.ts'
import { useLeilaoDaRota } from './rota.ts'
import Secao from './Secao.tsx'
import SecaoTempo from './tempo/SecaoTempo.tsx'
import Topo from './Topo.tsx'

export default function App() {
  const corrida = useCorrida()
  const rodando = corrida.fase === 'rodando' || corrida.fase === 'parando'
  const leilaoId = useLeilaoDaRota()
  const leilao = useLeilao(leilaoId) // a única assinatura SSE do leilão real, usada pelas seções 5 e 6

  return (
    <>
      <Topo />
      <main className="pagina">
        <Secao id="simulacao" kicker="1 · Simulação" titulo="O mesmo leilão, em 4 arquiteturas ao mesmo tempo"
          explicacao="Escolha a carga: as 4 arquiteturas partem do mesmo estado e recebem a mesma sequência de lances.">
          <Formulario rodando={rodando} ocupado={corrida.fase === 'iniciando' || corrida.fase === 'parando'}
            erro={corrida.erro} emAndamento={corrida.emAndamento !== null}
            aoAcompanhar={corrida.acompanhar} aoPararEmAndamento={corrida.pararEmAndamento} aoIniciar={corrida.iniciar} aoParar={corrida.parar} />
        </Secao>

        <Secao id="corrida" kicker="2 · Corrida ao vivo" titulo="Quem registra os lances mais rápido?"
          explicacao="Cada raia é uma arquitetura de verdade, gravando no próprio banco; os números chegam do servidor 4 vezes por segundo.">
          <div className="corrida-topo">
            <ResumoCorrida foto={corrida.foto} />
            <span className="selo-medido">{SELO}</span>
          </div>
          <p className="suave ressalvas">{RESSALVAS}</p>
          {(corrida.aviso || (corrida.erro && corrida.foto)) && (
            <div className="corrida-alertas">
              {corrida.erro && corrida.foto && <p className="alerta">{corrida.erro}</p>}
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

        <Secao id="caminho" kicker="5 · No sistema de verdade" titulo="Por onde passa um lance?"
          explicacao="Um lance real no leilão escolhido abaixo: da escrita (8081) ao Event Store, pelo Kafka até a leitura (8082) e de volta por SSE.">
          <SeletorLeilao leilaoId={leilaoId} leilao={leilao} />
          <SecaoCaminho key={leilaoId ?? ''} leilao={leilao} />
        </Secao>

        <Secao id="tempo" kicker="6 · Auditoria" titulo="Dá para voltar no tempo?"
          explicacao="Os eventos do mesmo leilão nunca são alterados; o estado de qualquer versão é refeito aplicando-os em ordem.">
          {leilaoId
            ? <SecaoTempo key={leilaoId} leilaoId={leilaoId} atual={leilao.estado?.versao ?? 0} />
            : <p className="painel suave">Escolha ou crie um leilão na seção anterior.</p>}
        </Secao>
      </main>
    </>
  )
}
