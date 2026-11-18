import { useState } from 'react'
import { ABAS, hrefDe, type Rota } from '../rota.ts'
import { aplicarTema, lerTema, type Tema } from '../tema.ts'
import { USUARIOS, type UsuarioId } from '../usuarios.ts'

interface Props {
  rota: Rota
  usuario: UsuarioId
  aoTrocarUsuario: (u: UsuarioId) => void
}

export default function Topo({ rota, usuario, aoTrocarUsuario }: Props) {
  const [tema, setTema] = useState<Tema>(lerTema)

  function alternarTema() {
    const novo: Tema = tema === 'claro' ? 'escuro' : 'claro'
    aplicarTema(novo)
    setTema(novo)
  }

  return (
    <header className="topo">
      <a className="marca" href={hrefDe({ aba: 'integridade', leilaoId: rota.leilaoId })}>Leilão<span>.</span></a>
      <nav className="abas" aria-label="Perguntas">
        {ABAS.map((a) => (
          <a key={a.id} href={hrefDe({ aba: a.id, leilaoId: rota.leilaoId })}
            aria-current={a.id === rota.aba ? 'page' : undefined}>
            {a.rotulo}
          </a>
        ))}
      </nav>
      <div className="topo-direita">
        <label className="usuario">
          estou como
          <select value={usuario} onChange={(e) => aoTrocarUsuario(e.target.value as UsuarioId)}>
            {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <button className="botao botao-tema" onClick={alternarTema} aria-pressed={tema === 'escuro'}
          aria-label="Alternar tema claro e escuro" title="Alternar tema">
          {tema === 'claro' ? '☾' : '☀'}
        </button>
      </div>
    </header>
  )
}
