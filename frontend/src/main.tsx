import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/plus-jakarta-sans'
import '@fontsource-variable/jetbrains-mono'
import './estilo/tokens.css'
import './estilo/base.css'
import './estilo/shell.css'
import './estilo/slides.css'
import './estilo/palco.css'
import './estilo/graficos.css'
import './estilo/abas.css'
import App from './App.tsx'
import { aplicarTema, lerTema } from './tema.ts'

aplicarTema(lerTema())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
