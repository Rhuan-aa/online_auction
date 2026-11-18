import type { ReactNode } from 'react'
import Slide from '../../shell/Slide.tsx'
import { usePlayer, type Player } from './usePlayer.ts'

interface Props {
  titulo: string
  /** Legenda de cada passo (índice 0 = passo 1). */
  legendas: string[]
  conclusao: string
  /** Conteúdo de cada lado no passo atual (0 = antes de começar). */
  nosso: (passo: number) => ReactNode
  alternativa: (passo: number) => ReactNode
  /** Quando preenchido, o visual mostra o aviso no lugar dos lados e trava os controles. */
  indisponivel?: string
  /** Observação curta sob o título (ex.: janela de lances truncada). */
  nota?: string
  /** Erro de carga a mostrar como alerta. */
  alerta?: string
}

function Controles({ p }: { p: Player }) {
  const { desabilitado, tocando, fim, passo } = p
  return (
    <div className="cenario-controles" role="group" aria-label="Controles da ilustração (não trocam de slide)">
      <span className="cenario-controles-rotulo">Ilustração</span>
      <button type="button" className="botao botao--destaque" disabled={desabilitado || tocando} onClick={p.tocar} aria-label="Tocar a ilustração">▶</button>
      <button type="button" className="botao" disabled={desabilitado || !tocando} onClick={p.pausar} aria-label="Pausar a ilustração">⏸</button>
      <button type="button" className="botao" disabled={desabilitado || fim} onClick={p.proximo} aria-label="Próximo passo da ilustração">⏭</button>
      <button type="button" className="botao" disabled={desabilitado || passo === 0} onClick={p.reiniciar} aria-label="Reiniciar a ilustração">↺</button>
    </div>
  )
}

/** Um slide dividido: à esquerda título, selo, legenda e controles; à direita "Nosso sistema | Alternativa". */
export default function Cenario({ titulo, legendas, conclusao, nosso, alternativa, indisponivel, nota, alerta }: Props) {
  const total = legendas.length
  const p = usePlayer(total, indisponivel != null || total === 0)
  const { passo, fim, desabilitado } = p

  return (
    <Slide
      titulo={titulo}
      texto={(
        <>
          <span className="selo-ilustracao">ilustração</span>
          {nota && <small className="suave cenario-nota-topo">{nota}</small>}
          {alerta && <p role="alert" className="erro">{alerta}</p>}
          {indisponivel == null && (
            <p className="cenario-legenda" aria-live="polite">
              {passo === 0 ? 'Aperte ▶ para começar.' : `${passo}/${total}. ${legendas[passo - 1]}`}
            </p>
          )}
          {fim && !desabilitado && <p className="cenario-conclusao">{conclusao}</p>}
        </>
      )}
      acao={<Controles p={p} />}
    >
      {indisponivel != null ? <p className="slide-vazio">{indisponivel}</p> : (
        <div className="cenario-lados">
          <section className="cenario-lado cenario-lado--nosso" aria-label="Nosso sistema">
            <h3>Nosso sistema</h3>
            {nosso(passo)}
          </section>
          <section className="cenario-lado" aria-label="Alternativa">
            <h3>Alternativa</h3>
            {alternativa(passo)}
          </section>
        </div>
      )}
    </Slide>
  )
}
