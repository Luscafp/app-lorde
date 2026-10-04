import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import {
  hashSegredo,
  JANELA_CONCORRENCIA_MS,
  SessaoService,
  VALIDADE_SESSAO_MS,
} from './sessao.service'

const SESSAO_ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const SEGREDO = 'Q2x0b2tlbi1zZWNyZXQtZXhlbXBsby0zMmJ5dGVzMDE'
const TOKEN = `${SESSAO_ID}.${SEGREDO}`
const HASH = hashSegredo(SEGREDO)
const AGORA = new Date('2026-10-04T12:00:00.000Z')

interface SessaoLida {
  usuarioId: string
  refreshTokenAnteriorHash: string | null
  rotacionadaEm: Date | null
  expiraEm: Date
  revogadaEm: Date | null
}

const sessaoLida = (dados: Partial<SessaoLida> = {}): SessaoLida => ({
  usuarioId: 'u1',
  refreshTokenAnteriorHash: null,
  rotacionadaEm: null,
  expiraEm: new Date(AGORA.getTime() + VALIDADE_SESSAO_MS),
  revogadaEm: null,
  ...dados,
})

function criarTx() {
  const sessao = {
    updateManyAndReturn: jest.fn().mockResolvedValue([]),
    findUnique: jest.fn().mockResolvedValue(null),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  }
  return { sessao, tx: { sessao } as unknown as TransacaoComEscopo }
}

const servico = new SessaoService()

describe('SessaoService.rotacionar', () => {
  it('feliz: grava o hash novo, o anterior, rotacionadaEm e expiraEm + 30 dias', async () => {
    const { sessao, tx } = criarTx()
    sessao.updateManyAndReturn.mockResolvedValue([{ usuarioId: 'u1', atleticaId: 'a1' }])

    const resultado = await servico.rotacionar(tx, TOKEN, AGORA)

    expect(resultado).toMatchObject({
      tipo: 'ROTACIONADA',
      sessaoId: SESSAO_ID,
      usuarioId: 'u1',
      atleticaId: 'a1',
    })
    const novoToken = resultado.tipo === 'ROTACIONADA' ? resultado.refreshToken : ''
    const [id, novoSegredo = ''] = novoToken.split('.')
    expect(id).toBe(SESSAO_ID)
    expect(novoSegredo).not.toBe(SEGREDO)
    expect(sessao.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: SESSAO_ID, refreshTokenHash: HASH, revogadaEm: null, expiraEm: { gt: AGORA } },
      data: {
        refreshTokenHash: hashSegredo(novoSegredo),
        refreshTokenAnteriorHash: HASH,
        rotacionadaEm: AGORA,
        expiraEm: new Date(AGORA.getTime() + VALIDADE_SESSAO_MS),
      },
      select: { usuarioId: true, atleticaId: true },
    })
    expect(sessao.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    ['sem separador', 'abc'],
    ['sessaoId que não é UUID', `123.${SEGREDO}`],
    ['segredo curto', `${SESSAO_ID}.abc`],
    ['segredo com caractere fora do base64url', `${SESSAO_ID}.${SEGREDO.slice(1)}+`],
  ])('formato inválido (%s) → INVALIDO sem consultar o banco', async (_caso, token) => {
    const { sessao, tx } = criarTx()

    await expect(servico.rotacionar(tx, token, AGORA)).resolves.toEqual({ tipo: 'INVALIDO' })
    expect(sessao.updateManyAndReturn).not.toHaveBeenCalled()
  })

  it('sessão inexistente → INVALIDO', async () => {
    const { tx } = criarTx()

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toEqual({ tipo: 'INVALIDO' })
  })

  it('sessão expirada → INVALIDO sem revogar', async () => {
    const { sessao, tx } = criarTx()
    sessao.findUnique.mockResolvedValue(sessaoLida({ expiraEm: AGORA }))

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toEqual({ tipo: 'INVALIDO' })
    expect(sessao.updateMany).not.toHaveBeenCalled()
  })

  it('sessão revogada → REVOGADA', async () => {
    const { sessao, tx } = criarTx()
    sessao.findUnique.mockResolvedValue(sessaoLida({ revogadaEm: AGORA }))

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toEqual({ tipo: 'REVOGADA' })
    expect(sessao.updateMany).not.toHaveBeenCalled()
  })

  it('token anterior dentro da janela de 30 s → JA_ROTACIONADO sem revogar', async () => {
    const { sessao, tx } = criarTx()
    const rotacionadaEm = new Date(AGORA.getTime() - JANELA_CONCORRENCIA_MS + 1)
    sessao.findUnique.mockResolvedValue(
      sessaoLida({ refreshTokenAnteriorHash: HASH, rotacionadaEm }),
    )

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toEqual({
      tipo: 'JA_ROTACIONADO',
    })
    expect(sessao.updateMany).not.toHaveBeenCalled()
  })

  it('token anterior fora da janela → REUSO e revoga com REUSO_REFRESH', async () => {
    const { sessao, tx } = criarTx()
    const rotacionadaEm = new Date(AGORA.getTime() - JANELA_CONCORRENCIA_MS)
    sessao.findUnique.mockResolvedValue(
      sessaoLida({ refreshTokenAnteriorHash: HASH, rotacionadaEm }),
    )

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toEqual({
      tipo: 'REUSO',
      sessaoId: SESSAO_ID,
      usuarioId: 'u1',
    })
    expect(sessao.updateMany).toHaveBeenCalledWith({
      where: { id: SESSAO_ID, revogadaEm: null },
      data: { revogadaEm: AGORA, motivoRevogacao: 'REUSO_REFRESH' },
    })
  })

  it('segredo desconhecido de uma sessão ativa, mesmo logo após rotação → REUSO', async () => {
    const { sessao, tx } = criarTx()
    sessao.findUnique.mockResolvedValue(
      sessaoLida({ refreshTokenAnteriorHash: hashSegredo('outro'), rotacionadaEm: AGORA }),
    )

    await expect(servico.rotacionar(tx, TOKEN, AGORA)).resolves.toMatchObject({ tipo: 'REUSO' })
  })
})

describe('SessaoService.revogarPorToken', () => {
  it('aceita o token atual ou o anterior e revoga a sessão não revogada', async () => {
    const { sessao, tx } = criarTx()
    sessao.updateManyAndReturn.mockResolvedValue([{ usuarioId: 'u1' }])

    await expect(servico.revogarPorToken(tx, TOKEN, 'LOGOUT', AGORA)).resolves.toEqual({
      sessaoId: SESSAO_ID,
      usuarioId: 'u1',
    })
    expect(sessao.updateManyAndReturn).toHaveBeenCalledWith({
      where: {
        id: SESSAO_ID,
        revogadaEm: null,
        OR: [{ refreshTokenHash: HASH }, { refreshTokenAnteriorHash: HASH }],
      },
      data: { revogadaEm: AGORA, motivoRevogacao: 'LOGOUT' },
      select: { usuarioId: true },
    })
  })

  it('nenhuma sessão afetada → null', async () => {
    const { tx } = criarTx()

    await expect(servico.revogarPorToken(tx, TOKEN, 'LOGOUT', AGORA)).resolves.toBeNull()
  })

  it('formato inválido → null sem consultar o banco', async () => {
    const { sessao, tx } = criarTx()

    await expect(servico.revogarPorToken(tx, 'lixo', 'LOGOUT', AGORA)).resolves.toBeNull()
    expect(sessao.updateManyAndReturn).not.toHaveBeenCalled()
  })
})

describe('SessaoService.revogar', () => {
  it('devolve se a sessão estava ativa', async () => {
    const { sessao, tx } = criarTx()

    await expect(servico.revogar(tx, SESSAO_ID, 'CONTA_DESATIVADA', AGORA)).resolves.toBe(true)
    sessao.updateMany.mockResolvedValue({ count: 0 })
    await expect(servico.revogar(tx, SESSAO_ID, 'CONTA_DESATIVADA', AGORA)).resolves.toBe(false)
  })
})

describe('SessaoService.revogarTodas', () => {
  it('sem opções: revoga as sessões ativas do usuário e devolve os ids', async () => {
    const { sessao, tx } = criarTx()
    sessao.updateManyAndReturn.mockResolvedValue([{ id: 's1' }, { id: 's2' }])

    await expect(servico.revogarTodas(tx, 'u1', 'CONTA_EXCLUIDA', {}, AGORA)).resolves.toEqual([
      's1',
      's2',
    ])
    expect(sessao.updateManyAndReturn).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', revogadaEm: null, expiraEm: { gt: AGORA } },
      data: { revogadaEm: AGORA, motivoRevogacao: 'CONTA_EXCLUIDA' },
      select: { id: true },
    })
  })

  it('com exceto e atleticaId: preserva a sessão e filtra pela atlética', async () => {
    const { sessao, tx } = criarTx()

    await servico.revogarTodas(tx, 'u1', 'TROCA_SENHA', { exceto: 's3', atleticaId: 'a1' }, AGORA)

    expect(sessao.updateManyAndReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          usuarioId: 'u1',
          revogadaEm: null,
          expiraEm: { gt: AGORA },
          id: { not: 's3' },
          atleticaId: 'a1',
        },
      }),
    )
  })

  it('sem sessões ativas → []', async () => {
    const { tx } = criarTx()

    await expect(servico.revogarTodas(tx, 'u1', 'TROCA_SENHA')).resolves.toEqual([])
  })
})
