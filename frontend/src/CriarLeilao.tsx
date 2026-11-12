import { useState, type FormEvent } from 'react'
import { api } from './api.ts'
import { paraCentavos } from './formato.ts'
import { irPara } from './rota.ts'
import { isVendedor, VENDEDOR, type UsuarioId } from './usuarios.ts'

/** Date → "2026-11-11T14:30", o formato do <input type="datetime-local">, no fuso local. */
function paraCampo(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function CriarLeilao({ usuario }: { usuario: UsuarioId }) {
  const [titulo, setTitulo] = useState('')
  const [precoInicial, setPrecoInicial] = useState('')
  const [incremento, setIncremento] = useState('')
  const [inicio, setInicio] = useState(() => paraCampo(new Date()))
  const [fim, setFim] = useState(() => paraCampo(new Date(Date.now() + 30 * 60_000)))
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function criar(e: FormEvent) {
    e.preventDefault()
    if (!isVendedor(usuario)) return
    const preco = paraCentavos(precoInicial)
    const inc = paraCentavos(incremento)
    if (!titulo.trim()) return setErro('Informe o título.')
    if (preco === null) return setErro('Informe um preço inicial maior que zero.')
    if (inc === null) return setErro('Informe um incremento mínimo maior que zero.')
    const inicioEm = new Date(inicio)
    const fimEm = new Date(fim)
    if (Number.isNaN(inicioEm.getTime()) || Number.isNaN(fimEm.getTime())) return setErro('Informe o início e o fim.')
    if (fimEm <= inicioEm) return setErro('O fim precisa ser depois do início.')

    setErro(null)
    setEnviando(true)
    try {
      const { leilaoId } = await api.criarLeilao({
        vendedorId: VENDEDOR, titulo: titulo.trim(), precoInicial: preco, incrementoMinimo: inc,
        inicioEm: inicioEm.toISOString(), fimEm: fimEm.toISOString(),
      })
      window.location.hash = irPara.detalhe(leilaoId)
    } catch (err) {
      setErro(err instanceof Error && err.name !== 'TypeError' ? err.message : 'Não foi possível falar com o servidor.')
      setEnviando(false)
    }
  }

  if (!isVendedor(usuario)) {
    return (
      <section>
        <h1>Criar leilão</h1>
        <p className="erro" role="alert">Só o vendedor cria leilões. Você está como {usuario}: troque para {VENDEDOR} no topo da página.</p>
      </section>
    )
  }

  return (
    <section>
      <h1>Criar leilão</h1>
      <p className="suave">O leilão é criado por {VENDEDOR}. Ele abre sozinho no horário de início (o agendador leva alguns segundos).</p>
      <form className="formulario" onSubmit={criar}>
        <label>Título
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={enviando} />
        </label>
        <label>Preço inicial (R$)
          <input inputMode="decimal" placeholder="100,00" value={precoInicial} onChange={(e) => setPrecoInicial(e.target.value)} disabled={enviando} />
        </label>
        <label>Incremento mínimo (R$)
          <input inputMode="decimal" placeholder="5,00" value={incremento} onChange={(e) => setIncremento(e.target.value)} disabled={enviando} />
        </label>
        <label>Início
          <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} disabled={enviando} />
        </label>
        <label>Fim
          <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} disabled={enviando} />
        </label>
        {erro && <p className="erro" role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}>{enviando ? 'Criando…' : 'Criar leilão'}</button>
      </form>
    </section>
  )
}
