import { useState } from 'react'
import { hrefDe, type Rota } from '../rota.ts'
import { SECOES } from '../secoes.ts'
import { aplicarTema, lerTema, type Tema } from '../tema.ts'
import { USUARIOS, type UsuarioId } from '../usuarios.ts'

interface Props {
  rota: Rota
  usuario: UsuarioId
  aoTrocarUsuario: (u: UsuarioId) => void
}

/** Barra de cima: marca, as 6 seções como segmentos de progresso, onde estou, "estou como" e o tema. */
export default function Topo({ rota, usuario, aoTrocarUsuario }: Props) {
  const [tema, setTema] = useState<Tema>(lerTema)
  const atual = Math.max(0, SECOES.findIndex((s) => s.id === rota.aba))

  function alternarTema() {
    const novo: Tema = tema === 'palco' ? 'claro' : 'palco'
    aplicarTema(novo)
    setTema(novo)
  }

  return (
    <header className="topo">
      <a className="marca" href={hrefDe({ aba: 'integridade', leilaoId: rota.leilaoId })}>
        leilão<span aria-hidden="true">●</span>
      </a>
      <nav className="secoes" aria-label="Seções">
        {SECOES.map((s, i) => (
          <a key={s.id} className="secao-seg" href={hrefDe({ aba: s.id, leilaoId: rota.leilaoId })}
            data-estado={i === atual ? 'atual' : i < atual ? 'vista' : 'adiante'}
            aria-current={i === atual ? 'page' : undefined} aria-label={`${i + 1}. ${s.rotulo}`} title={s.rotulo}>
            <span aria-hidden="true" />
          </a>
        ))}
      </nav>
      <p className="topo-onde" aria-hidden="true">
        <span className="id">{atual + 1} / {SECOES.length}</span> · {SECOES[atual].rotulo}
      </p>
      <div className="topo-direita">
        <label className="usuario">
          estou como
          <select value={usuario} onChange={(e) => aoTrocarUsuario(e.target.value as UsuarioId)}>
            {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <button className="botao-tema" onClick={alternarTema} aria-pressed={tema === 'claro'}
          aria-label="Tema claro" title={tema === 'claro' ? 'Voltar ao tema palco' : 'Usar tema claro'}>
          ◐
        </button>
      </div>
    </header>
  )
}
