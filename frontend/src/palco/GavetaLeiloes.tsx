import { useEffect, useState } from 'react'
import { api, type EstadoLeilao, type ResumoLeilao } from '../api.ts'
import { dataHora, dinheiro, ROTULO_STATUS } from '../formato.ts'
import { hrefDe, type Aba } from '../rota.ts'
import Gaveta from './Gaveta.tsx'

const FILTROS: { valor: EstadoLeilao['status'] | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'ABERTO', rotulo: 'Abertos' },
  { valor: 'CRIADO', rotulo: 'Agendados' },
  { valor: 'ENCERRADO', rotulo: 'Encerrados' },
  { valor: 'CANCELADO', rotulo: 'Cancelados' },
]

const INTERVALO_MS = 3000 // a lista não tem SSE: reconsulta de tempos em tempos

export default function GavetaLeiloes({ aba, aoFechar }: { aba: Aba; aoFechar: () => void }) {
  const [filtro, setFiltro] = useState<EstadoLeilao['status'] | ''>('')
  const [leiloes, setLeiloes] = useState<ResumoLeilao[] | null>(null)
  const [falhou, setFalhou] = useState(false)

  useEffect(() => {
    let ativo = true
    const carregar = () =>
      api.listarLeiloes(filtro || undefined)
        .then((l) => { if (ativo) { setLeiloes(l); setFalhou(false) } })
        .catch(() => { if (ativo) setFalhou(true) })
    carregar()
    const timer = setInterval(carregar, INTERVALO_MS)
    return () => { ativo = false; clearInterval(timer) }
  }, [filtro])

  return (
    <Gaveta titulo="Leilões" aoFechar={aoFechar}>
      <div className="filtros" role="group" aria-label="Filtrar por situação">
        {FILTROS.map((f) => (
          <button key={f.valor} aria-pressed={filtro === f.valor} onClick={() => { setLeiloes(null); setFiltro(f.valor) }}>
            {f.rotulo}
          </button>
        ))}
      </div>
      {falhou && <p className="erro" role="alert">Não consegui carregar a lista. Tentando de novo…</p>}
      {leiloes === null && !falhou && <p className="suave">Carregando…</p>}
      {leiloes?.length === 0 && <p className="suave">Nenhum leilão por aqui.</p>}
      <ul className="lista-leiloes">
        {leiloes?.map((l) => (
          <li key={l.leilaoId}>
            <a className="cartao" href={hrefDe({ aba, leilaoId: l.leilaoId })} onClick={aoFechar}>
              <strong>{l.titulo}</strong>
              <span className="lista-preco">{dinheiro(l.precoAtual)}</span>
              <span className={`status status-${l.status.toLowerCase()}`}>{ROTULO_STATUS[l.status]}</span>
              <span className="suave">{l.status === 'ENCERRADO' ? 'terminou' : 'termina'} {dataHora(l.fimEm)}</span>
            </a>
          </li>
        ))}
      </ul>
    </Gaveta>
  )
}
