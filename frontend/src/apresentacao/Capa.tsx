const TECNOLOGIAS = ['Apache Kafka', 'PostgreSQL', 'Redis', 'Java', 'React'] as const
const INTEGRANTES = 'Christian Ricci, Mariana Almeida, Nicolas Ferezini e Rhuan Andrey'

/** Primeira tela do modo apresentação (não aparece na página inteira): disciplina, título, as três decisões, as tecnologias e a equipe. */
export default function Capa({ oculta }: { oculta: boolean }) {
  return (
    <section className="capa" id="capa" aria-labelledby="capa-titulo" hidden={oculta}>
      <p className="capa-selo">Arquitetura de Software · Trabalho prático</p>
      <div className="capa-centro">
        <h1 className="capa-titulo" id="capa-titulo">Sistema de Leilão Online</h1>
        <p className="capa-subtitulo">Eventos com broker + Event Sourcing + cache versionado</p>
        <ul className="capa-tecnologias" aria-label="Tecnologias">
          {TECNOLOGIAS.map((t) => <li key={t}>{t}</li>)}
        </ul>
      </div>
      <p className="capa-integrantes"><strong>Integrantes:</strong> {INTEGRANTES}</p>
    </section>
  )
}
