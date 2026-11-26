import BarraApresentacao from './apresentacao/BarraApresentacao.tsx'
import Capa from './apresentacao/Capa.tsx'
import TelaObrigado from './apresentacao/TelaObrigado.tsx'
import TelaCaracteristicas from './apresentacao/TelaCaracteristicas.tsx'
import TelaContexto from './apresentacao/TelaContexto.tsx'
import TelaDesafios from './apresentacao/TelaDesafios.tsx'
import { TelaAdrBrokerContexto, TelaAdrBrokerDecisao, TelaAdrBrokerOpcoes } from './apresentacao/TelasAdrBroker.tsx'
import { TelaAdrEsContexto, TelaAdrEsDecisao, TelaAdrEsOpcoes } from './apresentacao/TelasAdrEventSourcing.tsx'
import { TelaAdrCacheContexto, TelaAdrCacheDecisao, TelaAdrCacheOpcoes } from './apresentacao/TelasAdrCache.tsx'
import { TelaAdrKafkaContexto, TelaAdrKafkaDecisao, TelaAdrKafkaOpcoes } from './apresentacao/TelasAdrKafka.tsx'
import { TelaC4Componentes, TelaC4Conteineres, TelaC4Contexto } from './apresentacao/TelasC4.tsx'
import { useApresentacao } from './apresentacao/useApresentacao.ts'
import Formulario from './corrida/Formulario.tsx'
import Graficos from './corrida/Graficos.tsx'
import Placar from './corrida/Placar.tsx'
import Raias, { ResumoCorrida } from './corrida/Raias.tsx'
import { RESSALVAS, SELO } from './corrida/tipos.ts'
import { useCorrida } from './corrida/useCorrida.ts'
import SecaoMini from './mini/SecaoMini.tsx'
import Secao from './Secao.tsx'
import Topo from './Topo.tsx'

/** As telas do modo apresentação: capa, contexto, características, desafios e ADRs (só existem nele) e depois as seções na ordem da página. */
const TELAS = [
  { id: 'capa', kicker: 'Capa' },
  { id: 'contexto', kicker: 'Contexto' },
  { id: 'caracteristicas', kicker: 'Características' },
  { id: 'desafios', kicker: 'Desafios → decisões' },
  { id: 'adr1-contexto', kicker: 'ADR-001 · Contexto' },
  { id: 'adr1-opcoes', kicker: 'ADR-001 · Opções' },
  { id: 'adr1-decisao', kicker: 'ADR-001 · Decisão' },
  { id: 'adr2-contexto', kicker: 'ADR-002 · Contexto' },
  { id: 'adr2-opcoes', kicker: 'ADR-002 · Opções' },
  { id: 'adr2-decisao', kicker: 'ADR-002 · Decisão' },
  { id: 'adr3-contexto', kicker: 'ADR-003 · Contexto' },
  { id: 'adr3-opcoes', kicker: 'ADR-003 · Opções' },
  { id: 'adr3-decisao', kicker: 'ADR-003 · Decisão' },
  { id: 'adr4-contexto', kicker: 'ADR-004 · Contexto' },
  { id: 'adr4-opcoes', kicker: 'ADR-004 · Opções' },
  { id: 'adr4-decisao', kicker: 'ADR-004 · Decisão' },
  { id: 'c4-contexto', kicker: 'C4 · Nível 1' },
  { id: 'c4-conteineres', kicker: 'C4 · Nível 2' },
  { id: 'c4-componentes', kicker: 'C4 · Nível 3' },
  { id: 'simulacao', kicker: '1 · Simulação' },
  { id: 'corrida', kicker: '2 · Corrida ao vivo' },
  { id: 'comparacao', kicker: '3 · Comparação' },
  { id: 'placar', kicker: '4 · Placar' },
  { id: 'mini', kicker: '5 · Mini leilão' },
  { id: 'obrigado', kicker: 'Obrigado' },
] as const

export default function App() {
  const corrida = useCorrida()
  const rodando = corrida.fase === 'rodando' || corrida.fase === 'parando'

  const apresentacao = useApresentacao(TELAS.length)
  /** id, kicker e se a seção fica escondida (só no modo apresentação, quando não é a tela atual). */
  const tela = (i: number) => ({ ...TELAS[i], oculta: apresentacao.ativa && apresentacao.atual !== i })
  /** Telas que só existem no modo apresentação: escondidas na página inteira. */
  const soNaApresentacao = (i: number) => !apresentacao.ativa || apresentacao.atual !== i

  return (
    <>
      <Topo apresentando={apresentacao.ativa} aoAlternarApresentacao={apresentacao.ativa ? apresentacao.sair : apresentacao.entrar} />
      <main className={apresentacao.ativa ? 'pagina pagina--apresentacao' : 'pagina'}>
        <Capa oculta={soNaApresentacao(0)} />
        <TelaContexto oculta={soNaApresentacao(1)} />
        <TelaCaracteristicas oculta={soNaApresentacao(2)} aoIrPara={(id) => apresentacao.ir(TELAS.findIndex((t) => t.id === id))} />
        <TelaDesafios oculta={soNaApresentacao(3)} />
        <TelaAdrBrokerContexto oculta={soNaApresentacao(4)} />
        <TelaAdrBrokerOpcoes oculta={soNaApresentacao(5)} />
        <TelaAdrBrokerDecisao oculta={soNaApresentacao(6)} />
        <TelaAdrEsContexto oculta={soNaApresentacao(7)} />
        <TelaAdrEsOpcoes oculta={soNaApresentacao(8)} />
        <TelaAdrEsDecisao oculta={soNaApresentacao(9)} />
        <TelaAdrCacheContexto oculta={soNaApresentacao(10)} />
        <TelaAdrCacheOpcoes oculta={soNaApresentacao(11)} />
        <TelaAdrCacheDecisao oculta={soNaApresentacao(12)} />
        <TelaAdrKafkaContexto oculta={soNaApresentacao(13)} />
        <TelaAdrKafkaOpcoes oculta={soNaApresentacao(14)} />
        <TelaAdrKafkaDecisao oculta={soNaApresentacao(15)} />
        <TelaC4Contexto oculta={soNaApresentacao(16)} aoIrPara={(id) => apresentacao.ir(TELAS.findIndex((t) => t.id === id))} />
        <TelaC4Conteineres oculta={soNaApresentacao(17)} aoIrPara={(id) => apresentacao.ir(TELAS.findIndex((t) => t.id === id))} />
        <TelaC4Componentes oculta={soNaApresentacao(18)} />

        <Secao {...tela(19)} titulo="O mesmo leilão, em 4 arquiteturas ao mesmo tempo"
          explicacao="Escolha a carga: as 4 arquiteturas partem do mesmo estado e recebem a mesma sequência de lances.">
          <Formulario rodando={rodando} ocupado={corrida.fase === 'iniciando' || corrida.fase === 'parando'}
            erro={corrida.erro} emAndamento={corrida.emAndamento !== null}
            aoAcompanhar={corrida.acompanhar} aoPararEmAndamento={corrida.pararEmAndamento} aoIniciar={corrida.iniciar} aoParar={corrida.parar} />
        </Secao>

        <Secao {...tela(20)} titulo="Quem registra os lances mais rápido?"
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

        <Secao {...tela(21)} titulo="Onde cada arquitetura ganha e perde"
          explicacao="Os mesmos números das raias, lado a lado; cada cor é sempre a mesma arquitetura.">
          <Graficos foto={corrida.foto} />
        </Secao>

        <Secao {...tela(22)} titulo="E o vencedor é…"
          explicacao="O melhor valor de cada critério fica destacado com ★; integridade diz se o resultado final está certo.">
          <div className="placar-topo"><span className="selo-medido">{SELO}</span></div>
          <Placar foto={corrida.foto} />
        </Secao>

        <Secao {...tela(23)} titulo="Quem foi superado fica sabendo?"
          explicacao="Ana e Bruno disputam um leilão real de 30 segundos: cada tela recebe o aviso quando é superada (e ele some quando ela volta a liderar), e no fim o vencedor é anunciado.">
          <SecaoMini />
        </Secao>

        <TelaObrigado oculta={soNaApresentacao(TELAS.length - 1)} />
      </main>
      {apresentacao.ativa && (
        <BarraApresentacao telas={TELAS} atual={apresentacao.atual} aoIr={apresentacao.ir} aoSair={apresentacao.sair} />
      )}
    </>
  )
}
