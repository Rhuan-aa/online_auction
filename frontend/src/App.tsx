import { useState } from 'react'
import CriarLeilao from './CriarLeilao.tsx'
import DetalheLeilao from './DetalheLeilao.tsx'
import ListaLeiloes from './ListaLeiloes.tsx'
import { irPara, useRota } from './rota.ts'
import { salvarUsuario, usuarioSalvo, USUARIOS, type UsuarioId } from './usuarios.ts'

export default function App() {
  const rota = useRota()
  const [usuario, setUsuario] = useState<UsuarioId>(usuarioSalvo)

  function trocarUsuario(novo: UsuarioId) {
    setUsuario(novo)
    salvarUsuario(novo)
  }

  return (
    <>
      <header className="topo">
        <a className="marca" href={irPara.lista()}><span className="logo" aria-hidden="true">⚖</span>Leilão online</a>
        <nav>
          <a href={irPara.lista()} aria-current={rota.tela === 'lista' ? 'page' : undefined}>Leilões</a>
          <a href={irPara.criar()} aria-current={rota.tela === 'criar' ? 'page' : undefined}>Criar leilão</a>
        </nav>
        <label className="usuario">
          Estou como:
          <select value={usuario} onChange={(e) => trocarUsuario(e.target.value as UsuarioId)}>
            {USUARIOS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </header>
      <main className="conteudo">
        {rota.tela === 'lista' && <ListaLeiloes />}
        {rota.tela === 'criar' && <CriarLeilao />}
        {rota.tela === 'detalhe' && <DetalheLeilao key={rota.leilaoId} leilaoId={rota.leilaoId} usuario={usuario} />}
      </main>
    </>
  )
}
