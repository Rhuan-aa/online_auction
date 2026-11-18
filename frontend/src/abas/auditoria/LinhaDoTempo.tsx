import { useEffect, useRef, useState } from 'react'
import type { EventoGravado } from '../../api.ts'
import { dataHora } from '../../formato.ts'
import { movimentoReduzido } from './diferencas.ts'

interface Props { eventos: EventoGravado[]; selecionada: number }

/** Um evento por linha, do mais antigo ao mais novo; clicar abre o JSON gravado. */
export default function LinhaDoTempo({ eventos, selecionada }: Props) {
  const [abertas, setAbertas] = useState<ReadonlySet<number>>(new Set())
  const itens = useRef(new Map<number, HTMLLIElement>())
  const listaRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    // rola só a lista (scrollIntoView arrastaria a página inteira junto)
    const lista = listaRef.current
    const item = itens.current.get(selecionada)
    if (!lista || !item) return
    const topo = item.offsetTop // a lista é position: relative, então é relativo a ela
    const alvo = Math.min(Math.max(lista.scrollTop, topo + item.offsetHeight - lista.clientHeight), topo)
    if (alvo !== lista.scrollTop) lista.scrollTo?.({ top: alvo, behavior: movimentoReduzido() ? 'auto' : 'smooth' })
  }, [selecionada, eventos]) // eventos: o item só existe depois da lista carregada / do evento novo

  function alternar(versao: number) {
    setAbertas((a) => { const n = new Set(a); if (!n.delete(versao)) n.add(versao); return n })
  }

  return (
    <ol className="linha-tempo" ref={listaRef} aria-label="Eventos gravados">
      {eventos.map((e) => {
        const aberta = abertas.has(e.versao)
        return (
          <li key={e.versao} ref={(el) => { if (el) itens.current.set(e.versao, el); else itens.current.delete(e.versao) }}
            className={e.versao === selecionada ? 'evento evento--atual' : 'evento'}>
            <button type="button" aria-expanded={aberta} onClick={() => alternar(e.versao)}>
              <span className="id">v{e.versao}</span>
              <span className="evento-tipo">{e.tipo.replace(/\.v\d+$/, '')}</span>
              <span className="suave">{dataHora(e.criadoEm)}</span>
            </button>
            {aberta && <pre className="evento-json">{JSON.stringify(e.dados, null, 2)}</pre>}
          </li>
        )
      })}
    </ol>
  )
}
