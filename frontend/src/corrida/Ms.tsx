import { convertido, ms } from './medidas.ts'

/** Valor sempre em ms; ao passar o mouse (ou focar com o teclado) mostra o mesmo tempo em s ou min. */
export default function Ms({ v }: { v: number | null | undefined }) {
  const conv = convertido(v)
  if (conv === null) return <>{ms(v)}</>
  return (
    <span className="ms-conv" tabIndex={0} data-conv={`= ${conv}`} aria-label={`${ms(v)}, ou seja ${conv}`}>{ms(v)}</span>
  )
}
