import { useCallback, useState } from 'react'
import AbaArquitetura from './abas/arquitetura/AbaArquitetura.tsx'
import AbaAuditoria from './abas/auditoria/AbaAuditoria.tsx'
import AbaESeFosse from './abas/eSeFosse/AbaESeFosse.tsx'
import AbaDesempenho from './abas/desempenho/AbaDesempenho.tsx'
import AbaIntegridade from './abas/integridade/AbaIntegridade.tsx'
import AbaRede from './abas/rede/AbaRede.tsx'
import GavetaLeiloes from './palco/GavetaLeiloes.tsx'
import GavetaNovoLeilao from './palco/GavetaNovoLeilao.tsx'
import Palco from './palco/Palco.tsx'
import { useAgora } from './palco/useAgora.ts'
import { usePalco } from './palco/usePalco.ts'
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

  function trocarUsuario(novo: UsuarioId) {
    setUsuario(novo)
    salvarUsuario(novo)
  }

  function aoCriar(leilaoId: string) {
    window.location.hash = hrefDe({ ...rota, leilaoId })
    fechar()
  }

  const aba = ABAS.find((a) => a.id === rota.aba) ?? ABAS[0]

  return (
    <>
      <Topo rota={rota} usuario={usuario} aoTrocarUsuario={trocarUsuario} />
      <div className="corpo">
        <Palco
          leilaoId={rota.leilaoId}
          palco={palco}
          agora={agora}
          usuario={usuario}
          aoAbrirLeiloes={() => setGaveta('leiloes')}
          aoAbrirNovo={() => setGaveta('novo')}
        />
        <main className="conteudo">
          {rota.aba === 'integridade'
            ? <AbaIntegridade pergunta={aba.pergunta} agora={agora} estado={palco.estado} incrementoMinimo={palco.incrementoMinimo} />
            : rota.aba === 'desempenho'
              ? <AbaDesempenho pergunta={aba.pergunta} />
              : rota.aba === 'rede'
                ? <AbaRede pergunta={aba.pergunta} agora={agora} estado={palco.estado} incrementoMinimo={palco.incrementoMinimo} usuario={usuario} />
                : rota.aba === 'auditoria'
                  ? <AbaAuditoria pergunta={aba.pergunta} estado={palco.estado} />
                  : rota.aba === 'arquitetura'
                    ? <AbaArquitetura key={rota.leilaoId ?? ''} pergunta={aba.pergunta} agora={agora} estado={palco.estado} incrementoMinimo={palco.incrementoMinimo} usuario={usuario} ultimoEvento={palco.ultimoEvento} leilaoId={rota.leilaoId} />
                    : rota.aba === 'e-se-fosse'
                      ? <AbaESeFosse pergunta={aba.pergunta} leilaoId={rota.leilaoId} versao={palco.estado?.versao ?? null} />
                      : <Aba pergunta={aba.pergunta} porQue={null} />}
        </main>
      </div>
      {gavetaAberta === 'leiloes' && <GavetaLeiloes aba={rota.aba} passo={rota.passo} aoFechar={fechar} />}
      {gavetaAberta === 'novo' && <GavetaNovoLeilao usuario={usuario} aoCriar={aoCriar} aoFechar={fechar} />}
    </>
  )
}
