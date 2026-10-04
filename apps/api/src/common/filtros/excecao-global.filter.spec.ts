import {
  ArgumentsHost,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import * as Sentry from '@sentry/nestjs'
import { ZodValidationException } from 'nestjs-zod'
import { z } from 'zod'
import { ErroAtleticaContextoAusente, ErroAtleticaDivergente } from '../../infra/contexto/erros'
import { ErroLimiteExcedido, ErroNegocio } from '../erros/erro-negocio'
import { ExcecaoGlobalFilter, MENSAGEM_ERRO_INTERNO, mapearExcecao } from './excecao-global.filter'

jest.mock('@sentry/nestjs', () => ({ captureException: jest.fn() }))

describe('mapearExcecao', () => {
  it('ZodValidationException → 400 VALIDATION_ERROR com details em notação de ponto', () => {
    const schema = z.object({ tags: z.array(z.string()) })
    const erro = schema.safeParse({ tags: [1] }).error
    expect(mapearExcecao(new ZodValidationException(erro))).toEqual({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos.',
      details: [{ field: 'tags.0', message: expect.any(String) as string }],
    })
  })

  it('ErroNegocio → status e code informados, details [] por padrão', () => {
    expect(mapearExcecao(new ErroNegocio(409, 'EXEMPLO_CONFLITO', 'Mensagem'))).toEqual({
      statusCode: 409,
      code: 'EXEMPLO_CONFLITO',
      message: 'Mensagem',
      details: [],
    })
  })

  it('ErroNegocio preserva details', () => {
    const details = [{ field: 'nome', message: 'Já existe.' }]
    expect(mapearExcecao(new ErroNegocio(422, 'X', 'Y', details)).details).toEqual(details)
  })

  it('UnauthorizedException sem code → 401 UNAUTHENTICATED', () => {
    expect(mapearExcecao(new UnauthorizedException())).toMatchObject({
      statusCode: 401,
      code: 'UNAUTHENTICATED',
    })
  })

  it('UnauthorizedException com code próprio → respeita code e message', () => {
    const excecao = new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Expirou.' })
    expect(mapearExcecao(excecao)).toEqual({
      statusCode: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Expirou.',
      details: [],
    })
  })

  it('ForbiddenException sem code → 403 FORBIDDEN', () => {
    expect(mapearExcecao(new ForbiddenException())).toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
    })
  })

  it('NotFoundException → 404 NOT_FOUND sem vazar a mensagem do Nest', () => {
    expect(mapearExcecao(new NotFoundException('Cannot GET /x'))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
      details: [],
    })
  })

  it('PayloadTooLargeException → 413 PAYLOAD_TOO_LARGE', () => {
    expect(mapearExcecao(new PayloadTooLargeException())).toMatchObject({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
    })
  })

  it('erro entity.too.large do body-parser → 413 PAYLOAD_TOO_LARGE', () => {
    const erro = Object.assign(new Error('request entity too large'), {
      type: 'entity.too.large',
      status: 413,
    })
    expect(mapearExcecao(erro)).toMatchObject({ statusCode: 413, code: 'PAYLOAD_TOO_LARGE' })
  })

  it('JSON malformado do body-parser → 400 VALIDATION_ERROR', () => {
    const erro = Object.assign(new SyntaxError('Unexpected token'), { type: 'entity.parse.failed' })
    expect(mapearExcecao(erro)).toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' })
  })

  it('HttpException genérica → HTTP_<status>', () => {
    expect(mapearExcecao(new ConflictException())).toMatchObject({
      statusCode: 409,
      code: 'HTTP_409',
    })
    expect(mapearExcecao(new HttpException('teapot', 418))).toMatchObject({
      statusCode: 418,
      code: 'HTTP_418',
    })
  })

  it('HttpException 5xx sem code → INTERNAL_ERROR sem a mensagem original', () => {
    expect(mapearExcecao(new InternalServerErrorException('segredo interno'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: MENSAGEM_ERRO_INTERNO,
      details: [],
    })
    expect(mapearExcecao(new ServiceUnavailableException())).toMatchObject({
      statusCode: 503,
      code: 'INTERNAL_ERROR',
    })
  })

  it('erro inesperado → 500 INTERNAL_ERROR com mensagem genérica', () => {
    expect(mapearExcecao(new Error('segredo interno'))).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: MENSAGEM_ERRO_INTERNO,
      details: [],
    })
  })
})

describe('mapearExcecao — erros do Prisma', () => {
  const SQL_INTERNO = 'new row for relation "Usuario" violates check constraint "x"'

  /** Erro do adapter `pg` como o Prisma 7 o anexa em `meta.driverAdapterError`. */
  function erroAdapter(originalCode: string) {
    return {
      name: 'DriverAdapterError',
      cause: { kind: 'postgres', code: originalCode, originalCode, message: SQL_INTERNO },
    }
  }

  function erroPrisma(code: string, meta?: Record<string, unknown>) {
    return new PrismaClientKnownRequestError(`Erro interno: ${SQL_INTERNO}`, {
      code,
      clientVersion: '7.10.0',
      meta,
    })
  }

  /** Violação de `CHECK` como o Prisma 7 + adapter `pg` a entrega. */
  function erroCheck(code: string) {
    return erroPrisma(code, { driverAdapterError: erroAdapter('23514') })
  }

  it('P2002 → 409 REGISTRO_DUPLICADO', () => {
    expect(
      mapearExcecao(erroPrisma('P2002', { driverAdapterError: erroAdapter('23505') })),
    ).toEqual({
      statusCode: 409,
      code: 'REGISTRO_DUPLICADO',
      message: 'Já existe um registro com esses dados.',
      details: [],
    })
  })

  it('P2025 → 404 NOT_FOUND', () => {
    expect(mapearExcecao(erroPrisma('P2025', { modelName: 'Evento' }))).toEqual({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Recurso não encontrado.',
      details: [],
    })
  })

  it('P2003 → 409 REGISTRO_EM_USO', () => {
    expect(mapearExcecao(erroPrisma('P2003'))).toEqual({
      statusCode: 409,
      code: 'REGISTRO_EM_USO',
      message: 'O registro está vinculado a outros dados.',
      details: [],
    })
  })

  it('CHECK (23514) via adapter pg (P2039) → 422 ESTADO_INVALIDO', () => {
    expect(mapearExcecao(erroCheck('P2039'))).toEqual({
      statusCode: 422,
      code: 'ESTADO_INVALIDO',
      message: 'A operação deixaria os dados em um estado inválido.',
      details: [],
    })
  })

  it('CHECK (23514) em SQL bruto (P2010) → 422 ESTADO_INVALIDO', () => {
    expect(mapearExcecao(erroCheck('P2010'))).toMatchObject({
      statusCode: 422,
      code: 'ESTADO_INVALIDO',
    })
  })

  it('CHECK (23514) do driver solto → 422 ESTADO_INVALIDO', () => {
    const erroPg = Object.assign(new Error(SQL_INTERNO), { code: '23514', constraint: 'x' })
    expect(mapearExcecao(erroPg)).toMatchObject({ statusCode: 422, code: 'ESTADO_INVALIDO' })
    expect(mapearExcecao(erroAdapter('23514'))).toMatchObject({ code: 'ESTADO_INVALIDO' })
  })

  it('outro erro de banco sem mapeamento → 500 INTERNAL_ERROR', () => {
    const erro = erroPrisma('P2039', { driverAdapterError: erroAdapter('22001') })
    expect(mapearExcecao(erro)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: MENSAGEM_ERRO_INTERNO,
      details: [],
    })
  })

  it.each([
    ['P2002', erroPrisma('P2002', { driverAdapterError: erroAdapter('23505') })],
    ['P2025', erroPrisma('P2025', { modelName: 'Evento' })],
    ['P2003', erroPrisma('P2003', { driverAdapterError: erroAdapter('23503') })],
    ['CHECK', erroCheck('P2039')],
  ])('%s nunca expõe SQL nem a mensagem interna no corpo', (_caso, erro) => {
    const corpo = JSON.stringify(mapearExcecao(erro))
    for (const interno of [SQL_INTERNO, 'Erro interno', 'Usuario', 'constraint', 'Evento']) {
      expect(corpo).not.toContain(interno)
    }
  })
})

describe('mapearExcecao — isolamento por atlética', () => {
  it.each([
    ['ErroAtleticaContextoAusente', new ErroAtleticaContextoAusente('Evento', 'findMany')],
    ['ErroAtleticaDivergente', new ErroAtleticaDivergente('Evento', 'create')],
  ])('%s → 500 INTERNAL_ERROR com a mensagem genérica', (_caso, erro) => {
    expect(mapearExcecao(erro)).toEqual({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: MENSAGEM_ERRO_INTERNO,
      details: [],
    })
  })
})

describe('ExcecaoGlobalFilter', () => {
  beforeEach(() => jest.mocked(Sentry.captureException).mockClear())

  function criarHost() {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const setHeader = jest.fn()
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/x' }),
        getResponse: () => ({ status, setHeader }),
      }),
    } as unknown as ArgumentsHost
    return { host, status, json, setHeader }
  }

  it('responde com o status e o corpo mapeados', () => {
    const { host, status, json } = criarHost()
    new ExcecaoGlobalFilter().catch(new ErroNegocio(422, 'ESTADO_INVALIDO', 'Inválido.'), host)
    expect(status).toHaveBeenCalledWith(422)
    expect(json).toHaveBeenCalledWith({
      statusCode: 422,
      code: 'ESTADO_INVALIDO',
      message: 'Inválido.',
      details: [],
    })
  })

  it('ErroLimiteExcedido → 429 RATE_LIMITED com Retry-After', () => {
    const { host, status, json, setHeader } = criarHost()
    new ExcecaoGlobalFilter().catch(new ErroLimiteExcedido(900), host)
    expect(status).toHaveBeenCalledWith(429)
    expect(setHeader).toHaveBeenCalledWith('Retry-After', '900')
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMITED' }))
  })

  it('demais erros não definem Retry-After', () => {
    const { host, setHeader } = criarHost()
    new ExcecaoGlobalFilter().catch(new ErroNegocio(429, 'RATE_LIMITED', 'x'), host)
    expect(setHeader).not.toHaveBeenCalled()
  })

  it('500 → captura no Sentry', () => {
    const erro = new Error('segredo interno')
    new ExcecaoGlobalFilter().catch(erro, criarHost().host)
    expect(Sentry.captureException).toHaveBeenCalledWith(erro, expect.any(Object))
  })

  it.each([400, 401, 403, 404, 409, 422, 429])('%i → não captura no Sentry', (status) => {
    new ExcecaoGlobalFilter().catch(new ErroNegocio(status, 'X', 'Y'), criarHost().host)
    expect(Sentry.captureException).not.toHaveBeenCalled()
  })
})
