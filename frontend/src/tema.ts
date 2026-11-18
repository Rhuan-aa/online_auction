// Tema "palco" (padrão, índigo) ou claro (sala iluminada), guardado no localStorage. O storage pode estar
// bloqueado (aba anônima, política do navegador), então toda leitura e escrita fica em try/catch.
// A chave é nova: na versão anterior o padrão "claro" era gravado ao abrir a página, e ler essa chave
// antiga deixaria quase todo mundo no tema claro em vez do palco.
export type Tema = 'palco' | 'claro'

const CHAVE = 'tema-apresentacao'

export function lerTema(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'palco'
  } catch {
    return 'palco'
  }
}

export function aplicarTema(t: Tema): void {
  document.documentElement.dataset.tema = t
  try {
    localStorage.setItem(CHAVE, t)
  } catch {
    // sem storage: o tema vale só até recarregar
  }
}
