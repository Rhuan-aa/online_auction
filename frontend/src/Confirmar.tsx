import { useEffect, useRef } from 'react'

interface Props {
  aberto: boolean
  titulo: string
  texto: string
  rotuloConfirmar: string
  perigo?: boolean
  aoConfirmar: () => void
  aoCancelar: () => void
}

/** Janela de confirmação da própria página (o confirm() do navegador mostra "localhost diz"). */
export default function Confirmar({ aberto, titulo, texto, rotuloConfirmar, perigo, aoConfirmar, aoCancelar }: Props) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (aberto && !d.open) d.showModal()
    if (!aberto && d.open) d.close()
  }, [aberto])

  return (
    <dialog ref={ref} className="modal" aria-labelledby="modal-titulo" onCancel={(e) => { e.preventDefault(); aoCancelar() }}>
      <h2 id="modal-titulo">{titulo}</h2>
      <p>{texto}</p>
      <div className="modal-botoes">
        <button onClick={aoCancelar} autoFocus>Voltar</button>
        <button className={perigo ? 'perigo' : undefined} onClick={aoConfirmar}>{rotuloConfirmar}</button>
      </div>
    </dialog>
  )
}
