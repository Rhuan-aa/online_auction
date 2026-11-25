const INTEGRANTES = ['Christian Ricci', 'Mariana Almeida', 'Nicolas Ferezini', 'Rhuan Andrey'] as const

/** Última tela do modo apresentação: agradecimento, equipe e convite às perguntas. */
export default function TelaObrigado({ oculta }: { oculta: boolean }) {
  return (
    <section className="capa obrigado" id="obrigado" aria-labelledby="obrigado-titulo" hidden={oculta}>
      <p className="capa-selo">Sistema de Leilão Online · Arquitetura de Software</p>
      <div className="capa-centro">
        <h1 className="capa-titulo obrigado-titulo" id="obrigado-titulo">Obrigado!</h1>
        <p className="capa-subtitulo">Perguntas?</p>
        <ul className="capa-tecnologias" aria-label="Integrantes">
          {INTEGRANTES.map((n) => <li key={n}>{n}</li>)}
        </ul>
      </div>
    </section>
  )
}
