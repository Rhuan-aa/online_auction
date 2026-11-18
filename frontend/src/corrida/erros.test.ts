import { expect, test } from 'vitest'
import { ErroHttp, FORA_DO_AR } from '../api.ts'
import { mensagemDeErro } from './erros.ts'

test('sem conexão: serviço fora do ar', () => expect(mensagemDeErro(new ErroHttp(0, 'x'))).toBe(FORA_DO_AR))
test('409: corrida em andamento', () => expect(mensagemDeErro(new ErroHttp(409, 'ocupado', 'CORRIDA_EM_ANDAMENTO'))).toMatch(/^Já existe uma corrida em andamento.*ocupado/))
test('400: mostra a mensagem do servidor', () => expect(mensagemDeErro(new ErroHttp(400, 'leitores inválido'))).toBe('O serviço recusou os parâmetros: leitores inválido'))
test('outros status', () => expect(mensagemDeErro(new ErroHttp(500, 'falhou'))).toBe('O serviço de corrida respondeu 500: falhou'))
test('erro comum', () => expect(mensagemDeErro(new Error('x'))).toBe('x'))
