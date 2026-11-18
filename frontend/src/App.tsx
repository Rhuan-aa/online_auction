import { useCallback, useState } from 'react'
import GavetaLeiloes from './palco/GavetaLeiloes.tsx'
import GavetaNovoLeilao from './palco/GavetaNovoLeilao.tsx'
import Palco from './palco/Palco.tsx'
import PainelAdm from './PainelAdm.tsx'
import { ABAS, hrefDe, useRota } from './rota.ts'
import Aba from './shell/Aba.tsx'
import Topo from './shell/Topo.tsx'
import { salvarUsuario, usuarioSalvo, type UsuarioId } from './usuarios.ts'

type Gaveta = 'leiloes' | 'novo' | null

export default function App() {
  const rota = useRota()
  const [usuario, setUsuario] = useState<UsuarioId>(usuarioSalvo)
  const [gaveta, setGaveta] = useState<Gaveta>(null)

  // Sem leilão em foco, o palco abre a lista para escolher um (até a pessoa fechá-la).
  const [dispensouLista, setDispensouLista] = useState(false)
  const gavetaAberta: Gaveta = gaveta ?? (!rota.leilaoId && !dispensouLista ? 'leiloes' : null)

  const fechar = useCallback(() => { setGaveta(null); setDispensouLista(true) }, [])

  function trocarUsuario(novo: UsuarioId) {
    setUsuario(novo)
    salvarUsuario(novo)
  }

  function aoCriar(leilaoId: string) {
    window.location.hash = hrefDe({ aba: rota.aba, leilaoId })
    fechar()
  }

  const aba = ABAS.find((a) => a.id === rota.aba) ?? ABAS[0]

  return (
    <>
      <Topo rota={rota} usuario={usuario} aoTrocarUsuario={trocarUsuario} />
      <div className="corpo">
        <Palco
          leilaoId={rota.leilaoId}
          usuario={usuario}
          aoAbrirLeiloes={() => setGaveta('leiloes')}
          aoAbrirNovo={() => setGaveta('novo')}
        />
        <main className="conteudo">
          <Aba pergunta={aba.pergunta} porQue={null}>
            {rota.aba === 'desempenho' && <PainelAdm />}
          </Aba>
        </main>
      </div>
      {gavetaAberta === 'leiloes' && <GavetaLeiloes aba={rota.aba} aoFechar={fechar} />}
      {gavetaAberta === 'novo' && <GavetaNovoLeilao usuario={usuario} aoCriar={aoCriar} aoFechar={fechar} />}
    </>
  )
}
