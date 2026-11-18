import type { CSSProperties, ReactNode } from 'react'
import { decimal, inteiro, ms, pct, pctDesatualizadas, progresso, segundos, temEscrita, textoStatus } from './medidas.ts'
import { ARQUITETURAS, corDe, NOTA_CRUD, type ArqFoto, type Foto } from './tipos.ts'
import type { Fase } from './useCorrida.ts'

interface Props { foto: Foto | null; fase: Fase }

const COLUNAS = ['Arquitetura', 'Lances enviados', 'Tempo para registrar um lance', 'Lances por segundo', 'Conflitos', 'Leituras desatualizadas', 'Status']

/** As 6 raias da corrida, na ordem do contrato. Antes da primeira foto, as raias aparecem vazias. */
export default function Raias({ foto, fase }: Props) {
  const arqs = foto?.arquiteturas ?? null
  return (
    <div className="raias">
      <div className="raia raias-cabecalho" aria-hidden="true">
        {COLUNAS.map((c, i) => (
          <span key={c}>{c}{i === 2 && <small>típico (pior caso embaixo)</small>}{i === 3 && <small>lances a cada 1 segundo</small>}</span>
        ))}
      </div>
      <ol className="raias-lista" aria-label="Arquiteturas na corrida">
        {arqs
          ? arqs.map((a) => <Raia key={a.id} a={a} />)
          : ARQUITETURAS.map((a) => <RaiaVazia key={a.id} id={a.id} nome={a.nome} descricao={a.descricao} fase={fase} />)}
      </ol>
      {arqs?.some((a) => a.id === 'crud' && a.leitura.desatualizadas > 0) && (
        <p className="suave raias-nota">* {NOTA_CRUD}</p>
      )}
    </div>
  )
}

const corDaRaia = (id: string) => ({ '--cor': corDe(id) }) as CSSProperties

function Metrica({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="raia-metrica">
      <span className="raia-rotulo">{rotulo}</span>
      <span className="raia-valor">{children}</span>
    </div>
  )
}

function Raia({ a }: { a: ArqFoto }) {
  const p = progresso(a)
  return (
    <li className="raia" style={corDaRaia(a.id)} data-status={a.status}>
      <div className="raia-nome">
        <strong>{a.nome}</strong>
        <span>{a.descricao}</span>
      </div>
      <div className="raia-progresso">
        <span className="raia-rotulo">Lances enviados</span>
        <div className="barra" role="progressbar" aria-label={`${a.nome}: lances enviados`}
          aria-valuemin={0} aria-valuemax={a.total} aria-valuenow={a.enviados}>
          <span style={{ width: `${p * 100}%` }} />
        </div>
        <span className="raia-contagem">{inteiro(a.enviados)} / {inteiro(a.total)}</span>
      </div>
      <Metrica rotulo="Tempo para registrar um lance (típico · pior caso)">
        {temEscrita(a) ? <>{ms(a.escrita.p50)}<small className="quebra">pior caso {ms(a.escrita.p95)}</small></> : '—'}
      </Metrica>
      <Metrica rotulo="Lances por segundo">{a.enviados > 0 ? <>{decimal(a.lancesPorSegundo)}<small className="quebra">lances/s</small></> : '—'}</Metrica>
      <Metrica rotulo="Conflitos">
        {inteiro(a.conflitos)}
        {a.retentativas > 0 && <small className="quebra" title="retentativas">{inteiro(a.retentativas)} ret.</small>}
      </Metrica>
      <Metrica rotulo="Leituras desatualizadas">
        {pct(pctDesatualizadas(a))}
        {a.id === 'crud' && a.leitura.desatualizadas > 0 && <small className="quebra" title={NOTA_CRUD}>versão voltou*</small>}
      </Metrica>
      <div className="raia-status" title={a.erro ?? undefined}>
        <span className="raia-rotulo">Status</span>
        <span className={`estado estado--${a.status}`}>{textoStatus(a)}</span>
      </div>
    </li>
  )
}

function RaiaVazia({ id, nome, descricao, fase }: { id: string; nome: string; descricao: string; fase: Fase }) {
  return (
    <li className="raia raia--vazia" style={corDaRaia(id)}>
      <div className="raia-nome">
        <strong>{nome}</strong>
        <span>{descricao}</span>
      </div>
      <div className="raia-progresso">
        <span className="raia-rotulo">Lances enviados</span>
        <div className="barra" aria-hidden="true"><span style={{ width: 0 }} /></div>
        <span className="raia-contagem">—</span>
      </div>
      {['Tempo para registrar um lance', 'Lances por segundo', 'Conflitos', 'Leituras desatualizadas'].map((r) => (
        <Metrica key={r} rotulo={r}>—</Metrica>
      ))}
      <div className="raia-status">
        <span className="raia-rotulo">Status</span>
        <span className="estado">{fase === 'iniciando' ? 'começando…' : 'aguardando'}</span>
      </div>
    </li>
  )
}

/** Linha de resumo acima das raias: tempo decorrido e parâmetros da corrida em curso. */
export function ResumoCorrida({ foto }: { foto: Foto | null }) {
  if (!foto) return null
  const p = foto.parametros
  return (
    <p className="resumo-corrida">
      <strong>{foto.rodando ? 'Rodando há' : 'Durou'} {segundos(foto.decorridoMs)}</strong>
      <span className="suave"> · {inteiro(p.licitantes)} licitantes × {inteiro(p.lancesPorLicitante)} lances, {inteiro(p.simultaneos)} simultâneos, {inteiro(p.leitores)} leitores</span>
    </p>
  )
}
