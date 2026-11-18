// Os passos 1 a 4 de Desempenho. O estado fica em AbaDesempenho (a seção continua montada).
import type { FormEvent, ReactNode } from 'react'
import type { ConfiguracaoCache, Servico } from '../../api.ts'
import { dataHora } from '../../formato.ts'
import { rotuloSimulacao } from '../../historico.ts'
import type { Progresso } from '../../simulacao.ts'
import Slide from '../../shell/Slide.tsx'
import FormSimulacao, { type Campos } from '../integridade/FormSimulacao.tsx'
import AoVivo from './AoVivo.tsx'
import type { AndamentoComparacao, Comparacao } from './comparacao.ts'
import ComparacaoAoVivo from './ComparacaoAoVivo.tsx'
import { GraficoCurva, GraficosCache, GraficosResultado } from './GraficosComparacao.tsx'

export type Ativa = Record<Servico, ConfiguracaoCache>

interface PropsComparar {
  pergunta: string
  ativa: Ativa | null
  divergem: boolean
  erroAtiva: string | null
  campos: Campos
  aoMudarCampos: (c: Campos) => void
  rodando: boolean
  andamento: AndamentoComparacao | null
  finais: Partial<Record<ConfiguracaoCache, Progresso>>
  erro: string | null
  aviso: string | null
  aoComparar: (e: FormEvent) => void
  aoInterromper: () => void
  temResultado: boolean
}

export function PassoComparar(p: PropsComparar) {
  const acao = (
    <>
      {p.ativa && <p className="config-grande config-ativa">Escrita: {p.ativa.escrita} · Leitura: {p.ativa.leitura}</p>}
      {p.divergem && <p className="aviso" role="alert">Escrita e leitura com configurações diferentes</p>}
      {p.erroAtiva && <p className="erro" role="alert">{p.erroAtiva}</p>}
      <form className="simulacao" onSubmit={p.aoComparar}>
        <FormSimulacao valor={p.campos} onChange={p.aoMudarCampos} desabilitado={p.rodando} />
        <div className="simulacao-botoes">
          {p.rodando
            ? <button type="button" className="botao botao--perigo" onClick={p.aoInterromper}>■ Interromper</button>
            : <button type="submit" className="botao botao--destaque">▶ Comparar A × B × C</button>}
        </div>
      </form>
      {p.rodando && <p className="aviso" role="alert">Durante a comparação, não dê lances em outros leilões</p>}
      {p.erro && <p className="erro" role="alert">{p.erro}</p>}
    </>
  )
  return (
    <Slide
      titulo={p.pergunta}
      texto={<p>Roda a mesma simulação em A, depois B, depois C, sem reiniciar nada, e devolve a configuração anterior.</p>}
      acao={acao}
    >
      {p.rodando
        ? <ComparacaoAoVivo andamento={p.andamento} finais={p.finais} />
        : <p className="slide-vazio">{p.temResultado ? 'Comparação concluída. Veja o resultado no próximo passo.' : 'As três colunas A, B e C enchem aqui enquanto a comparação roda.'}</p>}
      {p.aviso && <p className="aviso" role="alert">{p.aviso}</p>}
    </Slide>
  )
}

interface PropsResultado { selecionada: Comparacao | null; rodando: boolean }

const PLACEHOLDER = (rodando: boolean) => (
  <p className="slide-vazio">{rodando ? 'Comparando… acompanhe no passo 1.' : 'Rode a comparação no passo 1'}</p>
)

function Selecionado({ titulo, selecionada, rodando, children }: PropsResultado & { titulo: string; children: (c: Comparacao) => ReactNode }) {
  const pronta = selecionada && !rodando
  return (
    <Slide
      titulo={titulo}
      layout="largo"
      texto={pronta
        ? <p>{rotuloSimulacao(selecionada.parametros)} · {dataHora(selecionada.quando)}{!selecionada.completa && ' · incompleta'}</p>
        : undefined}
    >
      {pronta ? children(selecionada) : PLACEHOLDER(rodando)}
    </Slide>
  )
}

export function PassoResultado(p: PropsResultado) {
  return <Selecionado titulo="Resultado" {...p}>{(c) => <GraficosResultado comparacao={c} />}</Selecionado>
}

export function PassoPorDentro(p: PropsResultado) {
  return <Selecionado titulo="Por dentro do cache" {...p}>{(c) => <GraficosCache comparacao={c} />}</Selecionado>
}

interface PropsTempo extends PropsResultado {
  historico: Comparacao[]
  selecionadaId: string | null
  aoSelecionar: (id: string) => void
  configuracao: Ativa | null
}

export function PassoTempoVersao({ historico, selecionadaId, aoSelecionar, configuracao, selecionada, rodando }: PropsTempo) {
  return (
    <Slide titulo="Tempo × versão, histórico e ao vivo" layout="largo">
      <div className="tempo-versao">
        <div>{selecionada && !rodando ? <GraficoCurva comparacao={selecionada} /> : PLACEHOLDER(rodando)}</div>
        <AoVivo configuracao={configuracao} pausado={rodando} />
      </div>
      <section className="bloco-aba">
        <h2>Histórico de comparações</h2>
        {historico.length === 0
          ? <p className="suave">Nenhuma comparação ainda neste navegador.</p>
          : (
            <ul className="historico-comparacoes">
              {historico.map((c) => (
                <li key={c.id}>
                  <button type="button" aria-pressed={c.id === selecionadaId} disabled={rodando} onClick={() => aoSelecionar(c.id)}>
                    {dataHora(c.quando)} · {rotuloSimulacao(c.parametros)}{!c.completa && ' (incompleta)'}
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>
    </Slide>
  )
}
