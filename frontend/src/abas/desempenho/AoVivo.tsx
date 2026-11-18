// "Ao vivo": lê leilao.estado.obter a cada 2 s, só com a aba montada e visível, e desenha as taxas.
import { useEffect, useState } from 'react'
import { api, type ConfiguracaoCache, type Servico } from '../../api.ts'
import Sparkline from '../../graficos/Sparkline.tsx'
import { acumuladoDe, CAMINHO } from '../../metricas.ts'
import { anexarPonto, taxas, type Leitura } from './aoVivo.ts'

const INTERVALO_MS = 2000
const SERVICOS: Servico[] = ['escrita', 'leitura']
type Series = Record<Servico, { porSegundo: number[]; msMedio: number[] }>
const VAZIAS = (): Series => ({ escrita: { porSegundo: [], msMedio: [] }, leitura: { porSegundo: [], msMedio: [] } })

interface Props { configuracao: Record<Servico, ConfiguracaoCache> | null; pausado: boolean }

export default function AoVivo({ configuracao, pausado }: Props) {
  const [series, setSeries] = useState<Series>(VAZIAS)
  const cfgEscrita = configuracao?.escrita
  const cfgLeitura = configuracao?.leitura

  useEffect(() => {
    if (pausado || !cfgEscrita || !cfgLeitura) return
    const cfg: Record<Servico, ConfiguracaoCache> = { escrita: cfgEscrita, leitura: cfgLeitura }
    const anteriores: Partial<Record<Servico, Leitura>> = {}
    let ativo = true
    let lendo = false

    async function ler() {
      if (document.visibilityState !== 'visible' || lendo) return
      lendo = true
      try {
        for (const s of SERVICOS) {
          const a = await acumuladoDe(api, s, 'leilao.estado.obter', [`caminho:${CAMINHO[s]}`, `configuracao:${cfg[s]}`])
          if (!ativo) return
          const atual = { ...a, quando: Date.now() }
          const anterior = anteriores[s]
          anteriores[s] = atual
          if (!anterior) continue
          const t = taxas(anterior, atual)
          setSeries((v) => ({
            ...v,
            [s]: {
              porSegundo: anexarPonto(v[s].porSegundo, t.porSegundo),
              msMedio: t.msMedio === null ? v[s].msMedio : anexarPonto(v[s].msMedio, t.msMedio),
            },
          }))
        }
      } catch { /* serviço fora do ar ou métrica indisponível: tenta de novo no próximo ciclo */ } finally {
        lendo = false
      }
    }

    void ler()
    const timer = setInterval(() => void ler(), INTERVALO_MS)
    return () => { ativo = false; clearInterval(timer) }
  }, [cfgEscrita, cfgLeitura, pausado])

  return (
    <section className="bloco-aba">
      <h2>Ao vivo</h2>
      <p className="suave">
        {pausado ? 'Pausado durante a comparação.' : 'Lê as métricas dos serviços a cada 2 s, só com esta aba visível.'}
      </p>
      <div className="ao-vivo">
        {SERVICOS.map((s) => (
          <div key={s} className="ao-vivo-porta">
            <h3>{s === 'escrita' ? 'Escrita (8081)' : 'Leitura (8082)'}</h3>
            <Sparkline titulo={`Obtenções por segundo, ${s}`} unidade="obtenções/s" valores={series[s].porSegundo} />
            <p className="suave">obtenções/s</p>
            <Sparkline titulo={`Tempo médio por obtenção, ${s}`} unidade="ms" valores={series[s].msMedio} />
            <p className="suave">ms médio</p>
          </div>
        ))}
      </div>
    </section>
  )
}
