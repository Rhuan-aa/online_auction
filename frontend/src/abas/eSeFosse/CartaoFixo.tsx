import Cenario from './Cenario.tsx'
import type { Linha, Roteiro } from './cenarios.ts'

function Linhas({ linhas }: { linhas: Linha[] }) {
  return (
    <ul className="cenario-linhas">
      {linhas.map((l) => <li key={l.texto} className={l.tom ? `cenario-linha cenario-linha--${l.tom}` : 'cenario-linha'}>{l.texto}</li>)}
    </ul>
  )
}

/** Cartão cujo roteiro é fixo (REST × broker, RabbitMQ × Kafka). */
export default function CartaoFixo({ titulo, roteiro }: { titulo: string; roteiro: Roteiro }) {
  const { passos } = roteiro
  return (
    <Cenario
      titulo={titulo}
      legendas={passos.map((p) => p.legenda)}
      conclusao={roteiro.conclusao}
      nosso={(n) => (n === 0 ? null : <Linhas linhas={passos[n - 1].nosso} />)}
      alternativa={(n) => (n === 0 ? null : <Linhas linhas={passos[n - 1].alternativa} />)}
    />
  )
}
