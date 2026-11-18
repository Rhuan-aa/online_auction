import { useEffect, useState } from 'react'
import { api, type ConfiguracaoCache, type RelatorioReconstrucao } from '../../api.ts'
import Confirmar from '../../Confirmar.tsx'
import { movimentoReduzido, passosDaReconstrucao } from './diferencas.ts'

const INTERVALO_MS = 400

/** Apaga as cópias (Redis e checkpoints), refaz a partir dos eventos e mostra as 4 etapas uma a uma. */
export default function Reconstrucao() {
  const [confirmando, setConfirmando] = useState(false)
  const [rodando, setRodando] = useState(false)
  const [relatorio, setRelatorio] = useState<RelatorioReconstrucao | null>(null)
  const [visiveis, setVisiveis] = useState(0)
  const [configuracao, setConfiguracao] = useState<ConfiguracaoCache | undefined>(undefined)
  const [erro, setErro] = useState<string | null>(null)

  // Revela uma etapa a cada 400 ms; o cleanup limpa o timer (também ao desmontar).
  useEffect(() => {
    if (!relatorio || movimentoReduzido()) return
    let n = 1
    const t = setInterval(() => {
      n += 1
      setVisiveis(n)
      if (n >= 4) { clearInterval(t); setRodando(false) }
    }, INTERVALO_MS)
    return () => clearInterval(t)
  }, [relatorio])

  async function reconstruir() {
    setConfirmando(false)
    setRodando(true); setErro(null); setRelatorio(null); setVisiveis(0)
    try {
      const cfg = await api.lerConfiguracaoCache('escrita').catch(() => undefined) // lida antes: reconstruir não a muda
      const r = await api.reconstruirCache()
      setConfiguracao(cfg)
      const reduzido = movimentoReduzido() // sem animação: todas as etapas de uma vez
      setVisiveis(reduzido ? 4 : 1)
      setRelatorio(r)
      if (reduzido) setRodando(false)
    }
    catch (e) { setErro(e instanceof Error ? e.message : String(e)); setRodando(false) }
  }

  const passos = relatorio ? passosDaReconstrucao(relatorio, configuracao) : []

  return (
    <div>
      <button type="button" className="botao botao--destaque" disabled={rodando} onClick={() => setConfirmando(true)}>Reconstruir cache</button>
      {erro && <p role="alert" className="erro">{erro}</p>}
      <ol className="reconstrucao" aria-live="polite">
        {passos.slice(0, visiveis).map((p, i) => (
          <li key={i} className={p.ok ? 'passo' : 'passo passo--aviso'}>
            {p.texto} <span className="suave">({p.ms} ms)</span>
          </li>
        ))}
      </ol>
      <Confirmar aberto={confirmando} titulo="Reconstruir cache" perigo rotuloConfirmar="Reconstruir"
        texto="Apagar as cópias (Redis e checkpoints) e refazer a partir dos eventos?"
        aoConfirmar={() => { void reconstruir() }} aoCancelar={() => setConfirmando(false)} />
    </div>
  )
}
