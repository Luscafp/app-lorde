import type { NextFunction, Request, Response } from 'express'
import { requestIdMiddleware, resolverRequestId } from './request-id.middleware'

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('resolverRequestId', () => {
  it('aceita UUID v4 do cliente', () => {
    const id = '0b6c2f0e-1d2a-4c3b-9e8f-7a6b5c4d3e2f'
    expect(resolverRequestId(id)).toBe(id)
  })

  it.each([
    ['abc', 'abc'],
    ['string longa', `0b6c2f0e-1d2a-4c3b-9e8f-7a6b5c4d3e2f${'a'.repeat(500)}`],
    ['vazio', ''],
    ['ausente', undefined],
    ['UUID v1', '6fa459ea-ee8a-11ed-a05b-0242ac120003'],
    ['lista de cabeçalhos', ['0b6c2f0e-1d2a-4c3b-9e8f-7a6b5c4d3e2f']],
  ])('rejeita %s e gera um UUID v4', (_caso, recebido) => {
    const id = resolverRequestId(recebido)
    expect(id).toMatch(UUID_V4)
    expect(id).not.toBe(recebido)
  })
})

describe('requestIdMiddleware', () => {
  it('grava req.id e devolve X-Request-Id', () => {
    const req = { headers: { 'x-request-id': 'abc' } } as unknown as Request
    const setHeader = jest.fn()
    const next: NextFunction = jest.fn()
    requestIdMiddleware(req, { setHeader } as unknown as Response, next)
    expect(req.id).toMatch(UUID_V4)
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', req.id)
    expect(next).toHaveBeenCalled()
  })
})
