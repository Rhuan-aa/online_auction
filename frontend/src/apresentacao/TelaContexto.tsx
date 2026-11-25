import type { ReactNode } from 'react'
import { ICONES } from './icones.tsx'

interface Passo { atores: readonly string[]; icone: ReactNode; titulo: ReactNode; detalhe: string; chave?: boolean }

/** A vida de um leilão, da criação ao vencedor; cada passo mostra quem age (sigla dos atores). */
const PASSOS: readonly Passo[] = [
  { atores: ['V'], icone: ICONES.lapis, titulo: 'criado', detalhe: 'o vendedor abre o leilão' },
  { atores: ['L', 'L', 'L'], icone: ICONES.martelo, titulo: <span className="ctx-valores"><small>100</small>›<span>120</span>›<strong>150</strong></span>, detalhe: 'lances crescentes, ao vivo' },
  { atores: ['L'], icone: ICONES.relogio, titulo: <>últimos 30 s <b>⇒ +30 s</b></>, detalhe: 'anti-sniping', chave: true },
  { atores: ['L'], icone: ICONES.sino, titulo: 'superado', detalhe: 'é avisado na hora' },
  { atores: ['Ag'], icone: ICONES.trofeu, titulo: 'encerra', detalhe: 'no prazo: vencedor' },
]

const ATORES = [
  { sigla: 'V', nome: 'Vendedor', faz: 'cria e cancela' },
  { sigla: 'L', nome: 'Licitante', faz: 'dá lances e acompanha' },
  { sigla: 'Ag', nome: 'Agendador', faz: 'o relógio: abre e encerra' },
  { sigla: 'A', nome: 'ADM', faz: 'simula e mede (na demo)' },
] as const

/** Tela de contexto do modo apresentação: o leilão como uma linha do tempo, com quem age em cada passo. */
export default function TelaContexto({ oculta }: { oculta: boolean }) {
  return (
    <section className="tela-extra" id="contexto" aria-labelledby="contexto-titulo" hidden={oculta}>
      <p className="secao-kicker">Contexto</p>
      <h2 className="secao-titulo" id="contexto-titulo">Como funciona o leilão</h2>
      <p className="ctx-pergunta">Licitantes disputam o mesmo item com lances cada vez maiores. Quando o prazo acaba, o maior lance vence.</p>

      <div className="ctx-palco">
        <span className="ctx-aovivo-rotulo"><i className="ctx-aovivo" aria-hidden="true" />ao vivo</span>
        <ol className="ctx-tempo">
          {PASSOS.map((p, i) => (
            <li key={i} className={p.chave ? 'ctx-passo ctx-passo--chave' : 'ctx-passo'} style={{ animationDelay: `${0.15 + i * 0.18}s` }}>
              <span className="ctx-quem" aria-label={`quem age: ${p.atores.join(', ')}`}>
                {p.atores.map((a, j) => <i key={j} className={`ctx-mini ator-${a}`}>{a}</i>)}
              </span>
              <span className="ctx-marco">{p.icone}</span>
              <strong className="ctx-passo-titulo">{p.titulo}</strong>
              <span className="ctx-passo-detalhe">{p.detalhe}</span>
            </li>
          ))}
        </ol>
      </div>

      <ul className="ctx-legenda" aria-label="Atores">
        {ATORES.map((a) => (
          <li key={a.sigla}><i className={`ctx-mini ator-${a.sigla}`} aria-hidden="true">{a.sigla}</i><strong>{a.nome}</strong> {a.faz}</li>
        ))}
      </ul>
    </section>
  )
}
