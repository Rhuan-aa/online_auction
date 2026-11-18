import { useState } from 'react'
import CriarLeilao from './CriarLeilao.tsx'
import DetalheLeilao from './DetalheLeilao.tsx'
import ListaLeiloes from './ListaLeiloes.tsx'
import PainelAdm from './PainelAdm.tsx'
import { useRota } from './rota.ts'
import { isVendedor, salvarUsuario, usuarioSalvo, USUARIOS, type UsuarioId } from './usuarios.ts'

// Telas antigas, mantidas até as próximas tarefas trocarem pelo palco e pelas abas.
// #/criar e #/adm não são abas; viram rotas especiais só enquanto as telas antigas existirem.
export default function App() {
  const rota = useRota()
  const legado = window.location.hash.replace(/^#\/?/, '').split('?')[0]
  const [usuario, setUsuario] = useState<UsuarioId>(usuarioSalvo)

  function trocarUsuario(novo: UsuarioId) {
    setUsuario(novo)
    salvarUsuario(novo)
  }

  return (
    <>
      <header className="topo">
        <a className="marca" href="#/"><span className="logo" aria-hidden="true">⚖</span>Leilão online</a>
        <nav>
          <a href="#/">Leilões</a>
          {isVendedor(usuario) && <a href="#/criar">Criar leilão</a>}
          <a href="#/adm">Painel ADM</a>
        </nav>
        <label className="usuario">
          Estou como:
          <select value={usuario} onChange={(e) => trocarUsuario(e.target.value as UsuarioId)}>
            {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </header>
      <main className="conteudo">
        {legado === 'criar' && <CriarLeilao usuario={usuario} />}
        {legado === 'adm' && <PainelAdm />}
        {legado !== 'criar' && legado !== 'adm' && rota.leilaoId && (
          <DetalheLeilao key={rota.leilaoId} leilaoId={rota.leilaoId} usuario={usuario} />
        )}
        {legado !== 'criar' && legado !== 'adm' && !rota.leilaoId && <ListaLeiloes usuario={usuario} />}
      </main>
    </>
  )
}
