// Fotos de exemplo para os testes (formato do contrato).
import type { ArqFoto } from './tipos.ts'

export function arq(id: string, o: Partial<ArqFoto> = {}): ArqFoto {
  return {
    id, nome: id.toUpperCase(), descricao: '', status: 'rodando', erro: null, terminouEmMs: null,
    total: 200, enviados: 100, aceitos: 60, recusados: 40, conflitos: 0, retentativas: 0, lancesPorSegundo: 50,
    escrita: { p50: 4, p95: 10, amostras: 100 },
    leitura: { p50: 1, p95: 3, consultas: 100, desatualizadas: 0, pctDesatualizadas: 0, atrasoMedioVersoes: 0, atrasoMedioMs: 0 },
    curva: [], operacoes: { leiturasBanco: 100, escritasBanco: 60, opsRedis: 0, porLance: 1.6 },
    precoAtual: 10000, liderAtual: null, versaoAtual: 61,
    ...o,
  }
}
