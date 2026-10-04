import type { OpenAPIObject } from '@nestjs/swagger'
import { EXTENSAO_PUBLICO } from './decorators/publico.decorator'

const METODOS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/** Cadeado e resposta 401 em toda rota que não é `@Publico()`, espelhando a negação por padrão. */
export function documentarAutenticacao(documento: OpenAPIObject): OpenAPIObject {
  for (const caminho of Object.values(documento.paths)) {
    for (const metodo of METODOS) {
      const operacao = caminho[metodo]
      if (!operacao) continue
      const extensoes = operacao as unknown as Record<string, unknown>
      if (extensoes[EXTENSAO_PUBLICO]) {
        delete extensoes[EXTENSAO_PUBLICO]
        continue
      }
      operacao.security = [{ bearer: [] }]
      operacao.responses = {
        401: { description: 'Sessão inválida, expirada ou conta desativada.' },
        ...operacao.responses,
      }
    }
  }
  return documento
}
