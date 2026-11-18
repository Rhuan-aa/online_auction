import { useState } from 'react'
import { aplicarTema, lerTema, type Tema } from './tema.ts'

/** Barra de cima: marca, subtítulo e o botão de tema (palco ↔ claro). */
export default function Topo() {
  const [tema, setTema] = useState<Tema>(lerTema)

  function alternarTema() {
    const novo: Tema = tema === 'palco' ? 'claro' : 'palco'
    aplicarTema(novo)
    setTema(novo)
  }

  return (
    <header className="topo">
      <div className="topo-conteudo">
        <p className="marca">leilão<span aria-hidden="true">●</span></p>
        <p className="topo-subtitulo">Corrida de arquiteturas</p>
        <button type="button" className="botao-tema" onClick={alternarTema} aria-pressed={tema === 'claro'}
          aria-label="Tema claro" title={tema === 'claro' ? 'Voltar ao tema palco' : 'Usar tema claro'}>
          ◐
        </button>
      </div>
    </header>
  )
}
