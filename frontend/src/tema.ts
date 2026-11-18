// Tema claro (padrão) ou escuro, guardado no localStorage. O storage pode estar bloqueado
// (aba anônima, política do navegador), então toda leitura e escrita fica em try/catch.
export type Tema = 'claro' | 'escuro'

const CHAVE = 'tema'

export function lerTema(): Tema {
  try {
    return localStorage.getItem(CHAVE) === 'escuro' ? 'escuro' : 'claro'
  } catch {
    return 'claro'
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
