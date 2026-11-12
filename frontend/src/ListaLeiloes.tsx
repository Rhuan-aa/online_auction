import { useEffect, useState } from 'react'
import { api, type EstadoLeilao, type ResumoLeilao } from './api.ts'
import { dataHora, dinheiro, ROTULO_STATUS } from './formato.ts'
import { irPara } from './rota.ts'

const FILTROS: { valor: EstadoLeilao['status'] | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'ABERTO', rotulo: 'Abertos' },
  { valor: 'CRIADO', rotulo: 'Agendados' },
  { valor: 'ENCERRADO', rotulo: 'Encerrados' },
  { valor: 'CANCELADO', rotulo: 'Cancelados' },
]

const INTERVALO_MS = 3000 // a lista não tem SSE: reconsulta de tempos em tempos

export default function ListaLeiloes() {
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
    <section>
      <div className="cabecalho">
        <h1>Leilões</h1>
        <a className="botao" href={irPara.criar()}>+ Novo leilão</a>
      </div>
      <div className="filtros" role="group" aria-label="Filtrar por situação">
        {FILTROS.map((f) => (
          <button key={f.valor} aria-pressed={filtro === f.valor} onClick={() => { setLeiloes(null); setFiltro(f.valor) }}>
            {f.rotulo}
          </button>
        ))}
      </div>
      {falhou && <p className="erro" role="alert">Não consegui carregar a lista. Tentando de novo…</p>}
      {leiloes === null && !falhou && <p className="suave">Carregando…</p>}
      {leiloes?.length === 0 && <p className="vazio">Nenhum leilão por aqui. <a href={irPara.criar()}>Criar o primeiro</a>.</p>}
      <ul className="cartoes">
        {leiloes?.map((l) => (
          <li key={l.leilaoId}>
            <a className="cartao" href={irPara.detalhe(l.leilaoId)}>
              <strong>{l.titulo}</strong>
              <span className="preco">{dinheiro(l.precoAtual)}</span>
              <span className={`status status-${l.status.toLowerCase()}`}>{ROTULO_STATUS[l.status]}</span>
              <span className="suave">{l.status === 'ENCERRADO' ? 'terminou' : 'termina'} {dataHora(l.fimEm)}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
