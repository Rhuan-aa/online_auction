import { useCallback, useState } from 'react'
import AbaArquitetura from './abas/arquitetura/AbaArquitetura.tsx'
import AbaAuditoria from './abas/auditoria/AbaAuditoria.tsx'
import AbaESeFosse from './abas/eSeFosse/AbaESeFosse.tsx'
import AbaDesempenho from './abas/desempenho/AbaDesempenho.tsx'
import AbaIntegridade from './abas/integridade/AbaIntegridade.tsx'
import AbaRede from './abas/rede/AbaRede.tsx'
import CartaoAoVivo from './palco/CartaoAoVivo.tsx'
import GavetaLeiloes from './palco/GavetaLeiloes.tsx'
import GavetaNovoLeilao from './palco/GavetaNovoLeilao.tsx'
import { useAgora } from './palco/useAgora.ts'
import { usePalco } from './palco/usePalco.ts'
import { hrefDe, useRota } from './rota.ts'
import { secaoDe } from './secoes.ts'
import { SlideContexto } from './shell/contexto.ts'
import Navegacao from './shell/Navegacao.tsx'
import Topo from './shell/Topo.tsx'
import { useTeclasSlides } from './shell/useTeclasSlides.ts'
import { salvarUsuario, usuarioSalvo, type UsuarioId } from './usuarios.ts'

type Gaveta = 'leiloes' | 'novo' | null

export default function App() {
  const rota = useRota()
  const [usuario, setUsuario] = useState<UsuarioId>(usuarioSalvo)
  const [gaveta, setGaveta] = useState<Gaveta>(null)

  // Sem leilão em foco, o palco abre a lista para escolher um (até a pessoa fechá-la).
  const palco = usePalco(rota.leilaoId)
  const agora = useAgora(palco.estado?.status === 'ABERTO')
  const [dispensouLista, setDispensouLista] = useState(false)
  const [leilaoVisto, setLeilaoVisto] = useState(rota.leilaoId)
  if (leilaoVisto !== rota.leilaoId) { // outro leilão em foco: a lista pode abrir sozinha de novo
    setLeilaoVisto(rota.leilaoId)
    setDispensouLista(false)
  }
  const precisaEscolher = !rota.leilaoId || palco.situacao === 'nao-encontrado'
  const gavetaAberta: Gaveta = gaveta ?? (precisaEscolher && !dispensouLista ? 'leiloes' : null)

  const fechar = useCallback(() => { setGaveta(null); setDispensouLista(true) }, [])
  useTeclasSlides(rota.aba, rota.passo, rota.leilaoId, gavetaAberta === null)

  function trocarUsuario(novo: UsuarioId) {
    setUsuario(novo)
    salvarUsuario(novo)
  }

  function aoCriar(leilaoId: string) {
    window.location.hash = hrefDe({ ...rota, leilaoId })
    fechar()
  }

  const { pergunta } = secaoDe(rota.aba)
  const vivo = { agora, estado: palco.estado, incrementoMinimo: palco.incrementoMinimo }

  return (
    <div className="app">
      <Topo rota={rota} usuario={usuario} aoTrocarUsuario={trocarUsuario} />
      <SlideContexto value={{ aba: rota.aba, passo: 1 }}>
        <main className="area-slide">
          {rota.aba === 'integridade'
            ? <AbaIntegridade pergunta={pergunta} passo={rota.passo} {...vivo} />
            : rota.aba === 'desempenho'
              ? <AbaDesempenho pergunta={pergunta} />
              : rota.aba === 'rede'
                ? <AbaRede pergunta={pergunta} {...vivo} usuario={usuario} />
                : rota.aba === 'auditoria'
                  ? <AbaAuditoria pergunta={pergunta} estado={palco.estado} />
                  : rota.aba === 'arquitetura'
                    ? <AbaArquitetura key={rota.leilaoId ?? ''} pergunta={pergunta} {...vivo} usuario={usuario} ultimoEvento={palco.ultimoEvento} leilaoId={rota.leilaoId} />
                    : <AbaESeFosse pergunta={pergunta} leilaoId={rota.leilaoId} versao={palco.estado?.versao ?? null} />}
        </main>
      </SlideContexto>
      <footer className="rodape">
        <Navegacao rota={rota} />
        <CartaoAoVivo
          leilaoId={rota.leilaoId}
          palco={palco}
          agora={agora}
          usuario={usuario}
          aoAbrirLeiloes={() => setGaveta('leiloes')}
          aoAbrirNovo={() => setGaveta('novo')}
        />
      </footer>
      {gavetaAberta === 'leiloes' && <GavetaLeiloes aba={rota.aba} passo={rota.passo} aoFechar={fechar} />}
      {gavetaAberta === 'novo' && <GavetaNovoLeilao usuario={usuario} aoCriar={aoCriar} aoFechar={fechar} />}
    </div>
  )
}
