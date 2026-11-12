import { useEffect, useState } from 'react'
import AcoesLeilao from './AcoesLeilao.tsx'
import { api, ErroHttp, type EstadoLeilao, type LanceHistorico } from './api.ts'
import { dataHora, dinheiro, ROTULO_STATUS, tempoRestante } from './formato.ts'
import { irPara } from './rota.ts'
import type { UsuarioId } from './usuarios.ts'

/** Relógio da tela: a hora atual, atualizada a cada segundo enquanto `ativo`. */
function useAgora(ativo: boolean): number {
  const [agora, setAgora] = useState(() => Date.now())
  useEffect(() => {
    if (!ativo) return
    const timer = setInterval(() => setAgora(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [ativo])
  return agora
}

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

  const agora = useAgora(estado?.status === 'ABERTO')

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
      <p><a className="voltar" href={irPara.lista()}>← Voltar para os leilões</a></p>

      {naoEncontrado && !estado && (
        <p className="erro" role="alert">Leilão não encontrado (ou ainda sendo processado). Se você acabou de criar, aguarde um instante.</p>
      )}
      {!estado && !naoEncontrado && <p className="suave">Carregando…</p>}
      {conexaoCaiu && <p className="erro" role="status">Conexão ao vivo perdida. Tentando reconectar…</p>}

      {estado && (
        <>
          <div className="detalhe-topo">
            <h1>{estado.titulo}</h1>
            <span className={`status status-${estado.status.toLowerCase()}`}>{ROTULO_STATUS[estado.status]}</span>
          </div>
          {estado.status === 'ENCERRADO' && (
            <p className="resultado" role="status">
              {estado.liderId
                ? <>Leilão encerrado. Vencedor: <strong>{estado.liderId}</strong> com <strong>{dinheiro(estado.precoAtual)}</strong>.</>
                : 'Leilão encerrado sem lances.'}
            </p>
          )}
          {estado.status === 'CANCELADO' && <p className="resultado" role="status">Leilão cancelado pelo vendedor.</p>}
          <dl className="resumo">
            <div className="destaque">
              <dt>{estado.status === 'ENCERRADO' ? 'Valor final' : 'Preço atual'}</dt>
              <dd className="preco-grande">{dinheiro(estado.precoAtual)}</dd>
            </div>
            <div>
              <dt>{estado.status === 'ENCERRADO' ? 'Vencedor' : 'Líder'}</dt>
              <dd>{estado.liderId ?? 'sem lances'}</dd>
            </div>
            <div>
              <dt>{estado.status === 'ENCERRADO' ? 'Terminou' : 'Termina'}</dt>
              <dd>{dataHora(estado.fimEm)}</dd>
              {estado.status === 'ABERTO' && (
                <dd className={`contagem${Date.parse(estado.fimEm) - agora < 30_000 ? ' urgente' : ''}`}>
                  {Date.parse(estado.fimEm) > agora ? `Faltam ${tempoRestante(Date.parse(estado.fimEm) - agora)}` : 'Encerrando…'}
                </dd>
              )}
            </div>
          </dl>

          <AcoesLeilao estado={estado} usuario={usuario} />

          <h2>Lances ({lances.length})</h2>
          {lances.length === 0
            ? <p className="suave">Nenhum lance ainda.</p>
            : (
              <div className="tabela">
              <table className="lances">
                <thead><tr><th>#</th><th>Licitante</th><th>Valor</th><th>Quando</th></tr></thead>
                <tbody>
                  {[...lances].reverse().map((l, i) => (
                    <tr key={l.versao} className={i === 0 ? 'lider' : undefined}>
                      <td>{l.versao}</td>
                      <td>{l.licitanteId}{l.licitanteId === usuario && <span className="voce">você</span>}</td><td className="num">{dinheiro(l.valor)}</td><td>{dataHora(l.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
        </>
      )}
    </section>
  )
}
