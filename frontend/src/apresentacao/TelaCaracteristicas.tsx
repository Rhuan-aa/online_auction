import type { ReactNode } from 'react'
import { ICONES } from './icones.tsx'

/** Integridade: muitos lances ao mesmo tempo, um único vencedor. */
const VisualIntegridade = () => (
  <div className="car-vis car-vis--integridade" aria-label="50 lances simultâneos, 1 vencedor">
    <span className="car-pilha">{Array.from({ length: 5 }, (_, i) => <i key={i} className="ctx-mini ator-L">L</i>)}<b>×50</b></span>
    <span className="car-flecha" aria-hidden="true">→</span>
    <span className="car-um"><strong>1</strong>vencedor</span>
  </div>
)

/** Desempenho: tempo para obter o estado conforme o leilão cresce; sem cache sobe, com cache fica estável. */
const VisualDesempenho = () => (
  <svg className="car-vis car-grafico" viewBox="0 0 220 96" role="img" aria-label="Sem cache o tempo sobe a cada lance; com cache fica estável">
    <path className="car-eixo" d="M14 6v76h200" />
    <path className="car-linha car-linha--sobe" d="M16 74 C 80 70, 140 50, 210 12" pathLength={1} />
    <path className="car-linha car-linha--estavel" d="M16 70 L 210 64" pathLength={1} />
    <text x="112" y="30" className="car-rotulo car-rotulo--sobe">ES puro</text>
    <text x="150" y="58" className="car-rotulo car-rotulo--estavel">com cache</text>
    <text x="214" y="93" textAnchor="end" className="car-rotulo">lances →</text>
  </svg>
)

/** Auditabilidade: os eventos em ordem refazem qualquer versão, e o resultado bate com o cache. */
const VisualAuditoria = () => (
  <div className="car-vis car-vis--auditoria" aria-label="eventos em ordem refazem a versão 5, igual ao cache">
    <ol className="car-eventos">
      {['criado', 'lance', 'lance', '+30 s', 'lance'].map((e, i) => <li key={i}>{e}</li>)}
    </ol>
    <span className="car-flecha" aria-hidden="true">→</span>
    <span className="car-versao"><strong>v5</strong>= cache ✓</span>
  </div>
)

interface Caracteristica {
  n: number; cor: string; icone: ReactNode; nome: string; frase: string; porque: string
  visual: ReactNode; medida: string; demo: { id: string; rotulo: string }
}

const CARACTERISTICAS: readonly Caracteristica[] = [
  { n: 1, cor: 'destaque', icone: ICONES.escudo, nome: 'Integridade dos dados', frase: 'Nunca dois vencedores, mesmo com lances ao mesmo tempo.',
    porque: 'erro = prejuízo e processo', visual: <VisualIntegridade />, medida: '50 lances simultâneos → 0 leilões com dois vencedores',
    demo: { id: 'placar', rotulo: 'Placar: integridade' } },
  { n: 2, cor: 'sucesso', icone: ICONES.raio, nome: 'Desempenho', frase: 'Ler o leilão não fica mais lento a cada lance.',
    porque: 'o pico é nos segundos finais', visual: <VisualDesempenho />, medida: 'tempo por lance conforme o leilão cresce',
    demo: { id: 'comparacao', rotulo: 'Comparação' } },
  { n: 3, cor: 'aviso', icone: ICONES.historico, nome: 'Auditabilidade', frase: 'Todo lance fica registrado, completo e imutável.',
    porque: 'contestação exige prova', visual: <VisualAuditoria />, medida: 'qualquer versão refeita pelos eventos bate com o cache',
    demo: { id: 'tempo', rotulo: 'Auditoria' } },
]

interface Props { oculta: boolean; aoIrPara: (id: string) => void }

/** Tela das 3 características arquiteturais: o que é, um desenho de como se comporta e como medimos (com atalho para a demo). */
export default function TelaCaracteristicas({ oculta, aoIrPara }: Props) {
  return (
    <section className="tela-extra" id="caracteristicas" aria-labelledby="caracteristicas-titulo" hidden={oculta}>
      <p className="secao-kicker">Características arquiteturais</p>
      <h2 className="secao-titulo" id="caracteristicas-titulo">As três que mais importam</h2>

      <ol className="car-lista">
        {CARACTERISTICAS.map((c, i) => (
          <li key={c.n} className={`car-card cor-${c.cor}`} style={{ animationDelay: `${0.15 + i * 0.2}s` }}>
            <div className="car-topo">
              <span className="car-numero">{c.n}</span>
              <span className="car-icone">{c.icone}</span>
            </div>
            <h3 className="car-nome">{c.nome}</h3>
            <p className="car-frase">{c.frase}</p>
            <span className="car-porque">crítico: {c.porque}</span>
            {c.visual}
            <div className="car-medida">
              <span className="car-medida-rotulo">Como medimos</span>
              <span>{c.medida}</span>
              <button type="button" className="car-demo" onClick={() => aoIrPara(c.demo.id)}>ver na demo: {c.demo.rotulo} →</button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
