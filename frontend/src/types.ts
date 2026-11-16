// espelho dos corpos HTTP de backend/contratos — mudou lá, muda aqui
// Dinheiro em centavos; datas em string ISO-8601.

export interface CriarLeilaoRequest { vendedorId: string; titulo: string; precoInicial: number; incrementoMinimo: number; inicioEm: string; fimEm: string }
export interface DarLanceRequest { licitanteId: string; valor: number }
