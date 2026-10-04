import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import { ZodError } from 'zod'
import { DetalheErro, ErroNegocio, RespostaErro } from '../erros/erro-negocio'

export const MENSAGEM_ERRO_INTERNO = 'Ocorreu um erro inesperado. Tente novamente.'

const PADRAO_POR_STATUS: Partial<Record<number, { code: string; message: string }>> = {
  [HttpStatus.BAD_REQUEST]: { code: 'VALIDATION_ERROR', message: 'Dados inválidos.' },
  [HttpStatus.UNAUTHORIZED]: { code: 'UNAUTHENTICATED', message: 'Não autenticado.' },
  [HttpStatus.FORBIDDEN]: { code: 'FORBIDDEN', message: 'Acesso negado.' },
  [HttpStatus.NOT_FOUND]: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'O corpo da requisição excede o limite permitido.',
  },
}

/** Erros lançados pelo body-parser do Express antes de chegar ao Nest. */
const ERROS_BODY_PARSER: Record<string, number> = {
  'entity.too.large': HttpStatus.PAYLOAD_TOO_LARGE,
  'entity.parse.failed': HttpStatus.BAD_REQUEST,
}

/** 5xx sem code próprio nunca expõe detalhe: sai como `INTERNAL_ERROR` (convenções §4.1). */
function respostaPadrao(statusCode: number): RespostaErro {
  if (statusCode >= 500) return respostaErroInterno(statusCode)
  const padrao = PADRAO_POR_STATUS[statusCode]
  return {
    statusCode,
    code: padrao?.code ?? `HTTP_${statusCode}`,
    message: padrao?.message ?? 'Não foi possível concluir a requisição.',
    details: [],
  }
}

function detalhesZod(erro: unknown): DetalheErro[] {
  if (!(erro instanceof ZodError)) return []
  return erro.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message }))
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

/**
 * Exceção HTTP do Nest. Se foi criada com um objeto próprio (`{ code, message, details? }`),
 * o filtro o respeita; se o corpo foi montado pelo Nest (tem `statusCode`), usa o padrão do status.
 */
function mapearHttpException(excecao: HttpException): RespostaErro {
  const statusCode = excecao.getStatus()
  const padrao = respostaPadrao(statusCode)
  const corpo = excecao.getResponse()
  if (!ehObjeto(corpo) || 'statusCode' in corpo) return padrao
  if (statusCode >= 500 && typeof corpo.code !== 'string') return padrao

  return {
    statusCode,
    code: typeof corpo.code === 'string' ? corpo.code : padrao.code,
    message: typeof corpo.message === 'string' ? corpo.message : padrao.message,
    details: Array.isArray(corpo.details) ? (corpo.details as DetalheErro[]) : [],
  }
}

export function mapearExcecao(excecao: unknown): RespostaErro {
  if (excecao instanceof ZodValidationException) {
    return { ...respostaPadrao(400), details: detalhesZod(excecao.getZodError()) }
  }
  if (excecao instanceof ErroNegocio) {
    const { statusCode, code, message, details } = excecao
    return { statusCode, code, message, details }
  }
  if (excecao instanceof HttpException) return mapearHttpException(excecao)
  if (ehObjeto(excecao) && typeof excecao.type === 'string') {
    const statusCode = ERROS_BODY_PARSER[excecao.type]
    if (statusCode) return respostaPadrao(statusCode)
  }
  return respostaErroInterno(HttpStatus.INTERNAL_SERVER_ERROR)
}

function respostaErroInterno(statusCode: number): RespostaErro {
  return { statusCode, code: 'INTERNAL_ERROR', message: MENSAGEM_ERRO_INTERNO, details: [] }
}

/** Filtro global: toda resposta de erro sai no formato `{ statusCode, code, message, details }`. */
@Catch()
export class ExcecaoGlobalFilter implements ExceptionFilter {
  private readonly logger = new Logger(ExcecaoGlobalFilter.name)

  catch(excecao: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp()
    const requisicao = contexto.getRequest<Request>()
    const resposta = contexto.getResponse<Response>()
    const corpo = mapearExcecao(excecao)
    const rota = { method: requisicao.method, url: requisicao.originalUrl }

    if (corpo.statusCode >= 500) {
      this.logger.error({ err: excecao, ...rota, code: corpo.code }, 'Erro inesperado')
    } else {
      this.logger.warn({ ...rota, statusCode: corpo.statusCode, code: corpo.code }, corpo.message)
    }

    resposta.status(corpo.statusCode).json(corpo)
  }
}
