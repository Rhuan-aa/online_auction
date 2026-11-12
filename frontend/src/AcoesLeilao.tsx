import { useState, type FormEvent } from 'react'
import Confirmar from './Confirmar.tsx'
import { api, ErroHttp, type EstadoLeilao } from './api.ts'
import { dinheiro, paraCentavos } from './formato.ts'
import type { UsuarioId } from './usuarios.ts'

interface Props { estado: EstadoLeilao; usuario: UsuarioId }
type Aviso = { tipo: 'ok' | 'erro'; texto: string }

/** O backend avisa "Lance mínimo é 13000" (centavos): mostra em reais. */
function traduzirMensagem(codigo: string | undefined, mensagem: string | undefined): string {
  if (codigo === 'LANCE_ABAIXO_DO_MINIMO') {
    const centavos = mensagem?.match(/\d+/)?.[0]
    if (centavos) return `Lance abaixo do mínimo. O mínimo agora é ${dinheiro(Number(centavos))}.`
  }
  return mensagem ?? 'Lance recusado.'
}

export default function AcoesLeilao({ estado, usuario }: Props) {
  const [valor, setValor] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false)
  const [aviso, setAviso] = useState<Aviso | null>(null)

  const vendedor = usuario === 'vendedor-1'
  const aberto = estado.status === 'ABERTO'
  const cancelavel = estado.status === 'CRIADO' || estado.status === 'ABERTO'

  async function darLance(e: FormEvent) {
    e.preventDefault()
    const centavos = paraCentavos(valor)
    if (centavos === null) { setAviso({ tipo: 'erro', texto: 'Informe um valor maior que zero, por exemplo 150,00.' }); return }
    setEnviando(true)
    const r = await api.darLance(estado.leilaoId, { licitanteId: usuario, valor: centavos })
    setEnviando(false)
    if (r.tipo === 'aceito') { setValor(''); setAviso({ tipo: 'ok', texto: `Lance de ${dinheiro(centavos)} aceito.` }) }
    else if (r.tipo === 'recusado') setAviso({ tipo: 'erro', texto: traduzirMensagem(r.codigo, r.mensagem) })
    else if (r.tipo === 'conflito') setAviso({ tipo: 'erro', texto: 'Muitos lances ao mesmo tempo. Tente de novo.' })
    else setAviso({ tipo: 'erro', texto: r.status === 0 ? 'Não foi possível falar com o servidor.' : `Erro inesperado (${r.status}).` })
  }

  async function cancelar() {
    setConfirmandoCancelamento(false)
    setEnviando(true)
    try {
      await api.cancelarLeilao(estado.leilaoId, 'Cancelado pelo vendedor')
      setAviso({ tipo: 'ok', texto: 'Leilão cancelado.' })
    } catch (err) {
      const texto = err instanceof ErroHttp && err.codigo === 'LEILAO_COM_LANCES'
        ? 'Não dá para cancelar: o leilão já tem lances.'
        : err instanceof Error ? err.message : 'Não foi possível cancelar.'
      setAviso({ tipo: 'erro', texto })
    }
    setEnviando(false)
  }

  return (
    <div className="acoes">
      {aberto && !vendedor && (
        <form onSubmit={darLance}>
          <label htmlFor="valor-lance">Seu lance (R$) como {usuario}</label>
          <div className="linha">
            <input id="valor-lance" inputMode="decimal" placeholder="150,00" value={valor}
              onChange={(e) => setValor(e.target.value)} disabled={enviando} />
            <button type="submit" disabled={enviando}>Dar lance</button>
          </div>
        </form>
      )}
      {aberto && vendedor && <p className="suave">Você está como vendedor: troque o usuário para dar lance.</p>}
      {!aberto && <p className="suave">Este leilão não está aberto para lances.</p>}
      {vendedor && cancelavel && <button className="perigo" onClick={() => setConfirmandoCancelamento(true)} disabled={enviando}>Cancelar leilão</button>}
      <Confirmar
        aberto={confirmandoCancelamento}
        titulo="Cancelar este leilão?"
        texto="O leilão será encerrado sem vencedor. Isso não pode ser desfeito."
        rotuloConfirmar="Cancelar leilão"
        perigo
        aoConfirmar={cancelar}
        aoCancelar={() => setConfirmandoCancelamento(false)}
      />
      {aviso && <p className={aviso.tipo === 'erro' ? 'erro' : 'ok'} role={aviso.tipo === 'erro' ? 'alert' : 'status'}>{aviso.texto}</p>}
    </div>
  )
}
