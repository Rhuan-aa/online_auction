import { useState } from 'react'
import { aplicarTema, lerTema, type Tema } from './tema.ts'

interface Props { apresentando: boolean; aoAlternarApresentacao: () => void }

/** Barra de cima: marca, subtítulo, o botão do modo apresentação e o de tema (palco ↔ claro). */
export default function Topo({ apresentando, aoAlternarApresentacao }: Props) {
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
        <button type="button" className="botao-apresentar" onClick={aoAlternarApresentacao} aria-pressed={apresentando}
          title={apresentando ? 'Voltar à página inteira (Esc)' : 'Uma seção por tela; setas do teclado passam'}>
          {apresentando ? '■ Página inteira' : '▶ Apresentar'}
        </button>
        <button type="button" className="botao-tema" onClick={alternarTema} aria-pressed={tema === 'claro'}
          aria-label="Tema claro" title={tema === 'claro' ? 'Voltar ao tema palco' : 'Usar tema claro'}>
          ◐
        </button>
      </div>
    </header>
  )
}
