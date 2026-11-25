import { ICONES } from './icones.tsx'

/** Cada desafio do domínio e a decisão de arquitetura (ADR) que o resolve. */
const PARES = [
  { cor: 'destaque', icone: ICONES.raio, desafio: 'Concorrência', detalhe: 'lances no mesmo segundo', decisao: 'Event Store com versão', como: 'só um lance vence', adr: 'ADR-002' },
  { cor: 'sucesso', icone: ICONES.olho, desafio: 'Assimetria', detalhe: 'lido muito mais do que muda', decisao: 'Cache versionado', como: 'Redis + checkpoint', adr: 'ADR-003' },
  { cor: 'aviso', icone: ICONES.balanca, desafio: 'Contestação', detalhe: '“meu lance foi a tempo?”', decisao: 'Event Sourcing', como: 'o histórico é a prova', adr: 'ADR-002' },
  { cor: 'tinta', icone: ICONES.sino, desafio: 'Avisar na hora', detalhe: 'quem foi superado', decisao: 'Broker (Kafka) + SSE', como: 'cada parte no seu tempo', adr: 'ADR-001/004' },
] as const

const ICONE_DECISAO = [ICONES.livro, ICONES.camadas, ICONES.livro, ICONES.antena]

/** Tela "do problema à arquitetura": desafio → decisão, uma linha por par, aparecendo em sequência. */
export default function TelaDesafios({ oculta }: { oculta: boolean }) {
  return (
    <section className="tela-extra" id="desafios" aria-labelledby="desafios-titulo" hidden={oculta}>
      <p className="secao-kicker">Do problema à arquitetura</p>
      <h2 className="secao-titulo" id="desafios-titulo">Cada desafio pede uma decisão</h2>

      <ol className="des-pares">
        {PARES.map((p, i) => (
          <li key={p.desafio} className={`des-par cor-${p.cor}`} style={{ animationDelay: `${0.2 + i * 0.35}s` }}>
            <div className="des-desafio">
              <span className="des-icone">{p.icone}</span>
              <span><strong>{p.desafio}</strong><small>{p.detalhe}</small></span>
            </div>
            <span className="des-seta" aria-hidden="true" />
            <div className="des-decisao">
              <span className="des-icone">{ICONE_DECISAO[i]}</span>
              <span><strong>{p.decisao}</strong><small>{p.como}</small></span>
              <span className="des-adr">{p.adr}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
