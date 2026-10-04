import type { IncomingMessage, ServerResponse } from 'node:http'
import { RequestMethod } from '@nestjs/common'
import type { Request } from 'express'
import type { Params } from 'nestjs-pino'
import type { Level } from 'pino'
import type { Env } from '../../config/env.schema'
import { versaoApi } from '../../config/versao'
import { PREFIXO_API } from '../../configurar-app'
import { contextoDaRequisicao } from '../contexto/contexto-requisicao'
import { rotaDaRequisicao } from './rota'

export const ROTA_HEALTH = `/${PREFIXO_API}/health`
const MENSAGEM_ACESSO = 'Requisição concluída'

const CAMPOS_SENSIVEIS = [
  'senha',
  'senhaAtual',
  'novaSenha',
  'confirmacaoSenha',
  'refreshToken',
  'accessToken',
  'codigo',
  'tokenPush',
  'email',
]

export const CAMINHOS_REDIGIDOS = [
  'req.headers.authorization',
  'req.headers.cookie',
  ...CAMPOS_SENSIVEIS.flatMap((campo) => [campo, `*.${campo}`]),
]

const TAMANHO_MAXIMO_APP_VERSION = 50

export function nivelDoLog(statusCode: number, rota: string | undefined, erro?: unknown): Level {
  if (erro || statusCode >= 500) return 'error'
  if (statusCode >= 400) return 'warn'
  return rota === ROTA_HEALTH ? 'debug' : 'info'
}

/** Sem corpo, URL ou query string: só o padrão da rota (épico #5 §3 itens 2 e 3). */
function dadosDeAcesso(req: IncomingMessage, res: ServerResponse, durationMs: number) {
  const contexto = contextoDaRequisicao(req)
  const appVersion = req.headers['x-app-version']
  return {
    method: req.method,
    route: rotaDaRequisicao(req as Request),
    statusCode: res.statusCode,
    usuarioId: contexto?.usuarioId,
    atleticaId: contexto?.atleticaId,
    appVersion:
      typeof appVersion === 'string' ? appVersion.slice(0, TAMANHO_MAXIMO_APP_VERSION) : undefined,
    durationMs,
  }
}

/** JSON de uma linha fora do desenvolvimento; `pino-pretty` em desenvolvimento. */
export function criarConfigLogger(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL' | 'APP_ENV'>): Params {
  const legivel = env.NODE_ENV === 'development'
  return {
    // Sintaxe do path-to-regexp v8 (Express 5); o padrão '*' gera aviso.
    forRoutes: [{ path: '{*splat}', method: RequestMethod.ALL }],
    pinoHttp: {
      level: env.LOG_LEVEL,
      base: { service: 'api', env: env.APP_ENV, version: versaoApi() },
      redact: { paths: CAMINHOS_REDIGIDOS, censor: '[REDACTED]' },
      // `req.id` vem do request-id.middleware; todo log da requisição recebe só o `requestId`.
      quietReqLogger: true,
      quietResLogger: true,
      customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
      customLogLevel: (req, res, erro) =>
        nivelDoLog(res.statusCode, rotaDaRequisicao(req as Request), erro),
      customSuccessObject: (req, res, { durationMs }: { durationMs: number }) =>
        dadosDeAcesso(req, res, durationMs),
      // O erro em si já foi logado (com stack) pelo filtro global.
      customErrorObject: (req, res, _erro, { durationMs }: { durationMs: number }) =>
        dadosDeAcesso(req, res, durationMs),
      customSuccessMessage: () => MENSAGEM_ACESSO,
      customErrorMessage: () => MENSAGEM_ACESSO,
      ...(legivel && {
        transport: {
          target: 'pino-pretty',
          options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
        },
      }),
    },
  }
}
