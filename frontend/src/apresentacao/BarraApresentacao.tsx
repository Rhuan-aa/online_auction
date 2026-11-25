interface Props {
  telas: readonly { id: string; kicker: string }[]
  atual: number
  aoIr: (i: number) => void
  aoSair: () => void
}

/** Barra fixa embaixo no modo apresentação: anterior, uma bolinha por seção, contador, próxima e sair. */
export default function BarraApresentacao({ telas, atual, aoIr, aoSair }: Props) {
  const ultima = telas.length - 1
  return (
    <nav className="apresentacao-barra" aria-label="Navegação da apresentação">
      <button type="button" className="botao" onClick={() => aoIr(atual - 1)} disabled={atual === 0}>← Anterior</button>
      <ol className="apresentacao-pontos">
        {telas.map((t, i) => (
          <li key={t.id}>
            <button type="button" className="apresentacao-ponto" onClick={() => aoIr(i)} title={t.kicker}
              aria-label={`Ir para ${t.kicker}`} aria-current={i === atual ? 'step' : undefined} />
          </li>
        ))}
      </ol>
      <span className="apresentacao-contador" aria-live="polite">{atual + 1} / {telas.length}</span>
      <button type="button" className="botao botao--destaque" onClick={() => aoIr(atual + 1)} disabled={atual === ultima}>Próximo →</button>
      <button type="button" className="botao apresentacao-sair" onClick={aoSair} title="Sair da apresentação (Esc)">✕ Sair</button>
    </nav>
  )
}
