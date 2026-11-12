// Usuários fixos, sem login (PLANO.md, seção 2.6).
export const USUARIOS = ['vendedor-1', 'licitante-1', 'licitante-2', 'licitante-3'] as const
export type UsuarioId = (typeof USUARIOS)[number]

/** O vendedor é o único que cria e cancela leilões; os licitantes só dão lances. */
export const VENDEDOR: UsuarioId = 'vendedor-1'
export const isVendedor = (usuario: UsuarioId) => usuario === VENDEDOR

const CHAVE = 'usuario'

export function usuarioSalvo(): UsuarioId {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (USUARIOS.includes(salvo as UsuarioId)) return salvo as UsuarioId
  } catch { /* storage bloqueado: usa o padrão */ }
  return 'licitante-1'
}

export function salvarUsuario(usuario: UsuarioId) {
  try { localStorage.setItem(CHAVE, usuario) } catch { /* sem storage: só não lembra */ }
}
