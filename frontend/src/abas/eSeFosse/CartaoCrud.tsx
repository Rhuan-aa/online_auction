import type { EventoGravado } from '../../api.ts'
import { dinheiro } from '../../formato.ts'
import Cenario from './Cenario.tsx'
import { crud, MIN_LANCES, notaRecorte, SEM_LANCES, ultimosLances } from './cenarios.ts'

export default function CartaoCrud({ eventos, erro }: { eventos: EventoGravado[]; erro: boolean }) {
  const lances = ultimosLances(eventos)
  const passos = crud(lances)
  const pouco = lances.length < MIN_LANCES
  return (
    <Cenario
      titulo="CRUD × Event Sourcing"
      nota={notaRecorte(eventos, lances.length)}
      indisponivel={pouco ? (erro ? 'não foi possível carregar os eventos' : SEM_LANCES) : undefined}
      alerta={erro ? 'não foi possível carregar os eventos' : undefined}
      legendas={passos.map((p) => (p.apagado ? `O UPDATE sobrescreve a linha e apaga o ${p.apagado}.` : 'Lance mais antigo mostrado: a linha é preenchida.'))}
      conclusao="No CRUD só sobra o estado de agora. Guardando os fatos, qualquer versão do leilão pode ser refeita e auditada (ADR-002)."
      nosso={(n) => (
        <ol className="cenario-eventos">
          {lances.slice(0, n).map((e, i) => {
            const l = passos[i].linha
            return <li key={e.versao} className="cenario-evento"><b>v{e.versao}</b> LanceRegistrado: {l.lider} {dinheiro(l.preco)}</li>
          })}
        </ol>
      )}
      alternativa={(n) => {
        if (n === 0) return null
        const { linha, apagado } = passos[n - 1]
        return (
          <>
            <table className="cenario-tabela">
              <thead><tr><th>preço</th><th>líder</th><th>status</th></tr></thead>
              <tbody><tr><td>{dinheiro(linha.preco)}</td><td>{linha.lider}</td><td>{linha.status}</td></tr></tbody>
            </table>
            {apagado && <p className="cenario-perdido"><del>perdido: {apagado}</del></p>}
          </>
        )
      }}
    />
  )
}
