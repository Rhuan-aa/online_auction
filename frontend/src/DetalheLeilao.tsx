import { useEffect, useState } from 'react'
import AcoesLeilao from './AcoesLeilao.tsx'
import { api, ErroHttp, type EstadoLeilao, type LanceHistorico } from './api.ts'
import { dataHora, dinheiro } from './formato.ts'
import { irPara } from './rota.ts'
import type { UsuarioId } from './usuarios.ts'

export default function DetalheLeilao({ leilaoId, usuario }: { leilaoId: string; usuario: UsuarioId }) {
  const [estado, setEstado] = useState<EstadoLeilao | null>(null)
  const [lances, setLances] = useState<LanceHistorico[]>([])
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [conexaoCaiu, setConexaoCaiu] = useState(false)

  // Ao vivo: o SSE manda o estado atual ao conectar e de novo a cada mudança.
  useEffect(() => {
    const parar = api.observarLeilao(
      leilaoId,
      (novo) => { setEstado(novo); setNaoEncontrado(false); setConexaoCaiu(false) },
      () => setConexaoCaiu(true),
    )
    // O SSE fica mudo se o leilão não existe; uma consulta avisa. Logo após criar, o 404 pode ser só a projeção atrasada.
    api.consultarComCqrs(leilaoId).catch((e) => { if (e instanceof ErroHttp && e.status === 404) setNaoEncontrado(true) })
    return parar
  }, [leilaoId])

  // O histórico vem da mesma projeção: recarrega quando a versão do leilão muda.
  const versao = estado?.versao
  useEffect(() => {
    if (versao === undefined) return
    let ativo = true
    api.historicoLances(leilaoId).then((l) => { if (ativo) setLances(l) }).catch(() => {})
    return () => { ativo = false }
  }, [leilaoId, versao])

  return (
    <section>
      <p><a href={irPara.lista()}>← Voltar para os leilões</a></p>

      {naoEncontrado && !estado && (
        <p className="erro" role="alert">Leilão não encontrado (ou ainda sendo processado). Se você acabou de criar, aguarde um instante.</p>
      )}
      {!estado && !naoEncontrado && <p>Carregando…</p>}
      {conexaoCaiu && <p className="erro" role="status">Conexão ao vivo perdida. Tentando reconectar…</p>}

      {estado && (
        <>
          <div className="detalhe-topo">
            <h1>{estado.titulo}</h1>
            <span className={`status status-${estado.status.toLowerCase()}`}>{estado.status}</span>
          </div>
          <dl className="resumo">
            <div><dt>Preço atual</dt><dd className="preco-grande">{dinheiro(estado.precoAtual)}</dd></div>
            <div><dt>Líder</dt><dd>{estado.liderId ?? 'sem lances'}</dd></div>
            <div><dt>Termina</dt><dd>{dataHora(estado.fimEm)}</dd></div>
          </dl>

          <AcoesLeilao estado={estado} usuario={usuario} />

          <h2>Lances ({lances.length})</h2>
          {lances.length === 0
            ? <p className="suave">Nenhum lance ainda.</p>
            : (
              <table className="lances">
                <thead><tr><th>#</th><th>Licitante</th><th>Valor</th><th>Quando</th></tr></thead>
                <tbody>
                  {[...lances].reverse().map((l) => (
                    <tr key={l.versao}>
                      <td>{l.versao}</td><td>{l.licitanteId}</td><td className="num">{dinheiro(l.valor)}</td><td>{dataHora(l.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </>
      )}
    </section>
  )
}
