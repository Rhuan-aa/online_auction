// As três colunas A | B | C enchendo enquanto a comparação roda; a da vez fica destacada.
import type { ConfiguracaoCache } from '../../api.ts'
import type { AndamentoComparacao } from './comparacao.ts'

const NOMES: Record<ConfiguracaoCache, string> = { A: 'A · sem cópia', B: 'B · só checkpoint', C: 'C · Redis + checkpoint' }

export default function ComparacaoAoVivo({ andamento, aoInterromper }: { andamento: AndamentoComparacao | null; aoInterromper: () => void }) {
  return (
    <div className="comparando">
      <p className="aviso" role="alert">Durante a comparação, não dê lances em outros leilões</p>
      <div className="colunas-abc">
        {(['A', 'B', 'C'] as const).map((c) => {
          const feita = andamento?.feitas.includes(c) ?? false
          const vez = andamento?.configuracao === c && !feita
          const p = vez ? andamento?.progresso : undefined
          return (
            <div key={c} className={`coluna-abc${vez ? ' coluna-abc--vez' : ''}`} aria-current={vez ? 'step' : undefined}>
              <h3>{NOMES[c]}</h3>
              {feita && <p>Concluída</p>}
              {vez && p && (
                <>
                  <p>{p.fase}…</p>
                  <p>{p.enviados}/{p.total} enviados</p>
                  <p>{p.aceitos} aceitos · {p.recusados} recusados · {p.conflitos} conflitos</p>
                  <p>{p.consultas} consultas</p>
                </>
              )}
              {!feita && !vez && <p className="suave">Aguardando</p>}
            </div>
          )
        })}
      </div>
      <button type="button" className="botao botao--perigo" onClick={aoInterromper}>■ Interromper</button>
    </div>
  )
}
