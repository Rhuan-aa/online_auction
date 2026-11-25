import type { ReactNode } from 'react'

/** Ícones de traço simples para as telas da apresentação (herdam a cor do texto). */
const icone = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
)

export const ICONES = {
  raio: icone(<><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>),
  olho: icone(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>),
  balanca: icone(<><path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" /></>),
  lapis: icone(<><path d="M4 20h4L19 9l-4-4L4 16z" /></>),
  martelo: icone(<><path d="m14 4 6 6M11 7l6 6M12.5 5.5l-7 7M3 21l7-7M2 22h9" /></>),
  relogio: icone(<><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2 2M9 2h6" /></>),
  sino: icone(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></>),
  trofeu: icone(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /></>),
  camadas: icone(<><path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5" /></>),
  livro: icone(<><path d="M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z" /></>),
  escudo: icone(<><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></>),
  historico: icone(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /><path d="M12 7v5l3 2" /></>),
  ramos: icone(<><circle cx="5" cy="12" r="2" /><circle cx="19" cy="5" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="19" cy="19" r="2" /><path d="M7 12h10M7 11l10-5M7 13l10 5" /></>),
  mais: icone(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>),
  desligado: icone(<><path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4M3 3l18 18" /></>),
  fila: icone(<><path d="M4 6h16M4 12h16M4 18h16" /><path d="M8 4v4M12 10v4M16 16v4" /></>),
  cadeado: icone(<><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  antena: icone(<><circle cx="12" cy="12" r="2" /><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8" /></>),
}
