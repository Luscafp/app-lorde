import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService, EntradaAuditoria } from '../auditoria/auditoria.service'
import type { UploadsService } from '../uploads/uploads.service'
import { BannersService } from './banners.service'

const callbacksAposCommit: (() => unknown)[] = []

jest.mock('../../infra/eventos/apos-commit', () => ({
  aposCommit: (callback: () => unknown) => callbacksAposCommit.push(callback),
}))

const ID = 'b7e1c0de-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const OUTRO = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const TERCEIRO = '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a91'
const ATLETICA_ID = '1f2a3b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const DIRETOR = { id: '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90', atleticaId: ATLETICA_ID }
const IMAGEM = `atleticas/${ATLETICA_ID}/banners/${DIRETOR.id}/a.webp`
const IMAGEM_NOVA = `atleticas/${ATLETICA_ID}/banners/${DIRETOR.id}/b.webp`
const DATA = new Date('2026-10-01T12:00:00.000Z')

type Linha = {
  id: string
  titulo: string
  imagemKey: string
  link: string | null
  ordem: number
  ativo: boolean
  criadoEm: Date
  atualizadoEm: Date
}

function linha(parcial: Partial<Linha> = {}): Linha {
  return {
    id: ID,
    titulo: 'Inscrições abertas',
    imagemKey: IMAGEM,
    link: null,
    ordem: 0,
    ativo: true,
    criadoEm: DATA,
    atualizadoEm: DATA,
    ...parcial,
  }
}

interface Cenario {
  atual?: Linha | null
  ativos?: number
  ultimaOrdem?: number | null
  ids?: string[]
}

function criarServico({ atual = linha(), ativos = 0, ultimaOrdem = null, ids = [] }: Cenario = {}) {
  const tx = {
    $executeRaw: jest.fn(),
    banner: {
      findFirst: jest.fn(({ orderBy }: { orderBy?: unknown }) =>
        Promise.resolve(orderBy ? (ultimaOrdem === null ? null : { ordem: ultimaOrdem }) : atual),
      ),
      findMany: jest.fn(({ select }: { select: Record<string, boolean> }) =>
        Promise.resolve(select.titulo ? ids.map((id) => linha({ id })) : ids.map((id) => ({ id }))),
      ),
      count: jest.fn().mockResolvedValue(ativos),
      create: jest.fn(({ data }: { data: Partial<Linha> }) => Promise.resolve(linha(data))),
      update: jest.fn(({ data }: { data: Partial<Linha> }) =>
        Promise.resolve(linha({ ...atual, ...data })),
      ),
      delete: jest.fn(),
    },
  }
  const db = {
    banner: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(atual),
      count: jest.fn().mockResolvedValue(0),
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn() }
  const uploads = {
    urlPublica: jest.fn((key: string) => `https://img/${key}`),
    validarKey: jest.fn(),
    remover: jest.fn(),
  }
  const servico = new BannersService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    uploads as unknown as UploadsService,
  )
  const entradas = () => auditoria.registrar.mock.calls as [unknown, EntradaAuditoria][]
  const auditado = () =>
    entradas().map(([, { acao, entidadeId, dados }]) => ({ acao, entidadeId, dados }))
  return { servico, tx, db, auditoria, uploads, auditado }
}

beforeEach(() => {
  callbacksAposCommit.length = 0
})

describe('BannersService', () => {
  describe('listarAtivos', () => {
    it('só ativos, por ordem e depois o mais antigo, com imagemUrl', async () => {
      const { servico, db } = criarServico()
      db.banner.findMany.mockResolvedValue([linha({ link: 'https://exemplo.com' })])

      await expect(servico.listarAtivos()).resolves.toEqual({
        items: [
          {
            id: ID,
            titulo: 'Inscrições abertas',
            imagemUrl: `https://img/${IMAGEM}`,
            link: 'https://exemplo.com',
          },
        ],
      })
      expect(db.banner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ativo: true },
          orderBy: [{ ordem: 'asc' }, { criadoEm: 'asc' }, { id: 'asc' }],
        }),
      )
    })
  })

  describe('listar', () => {
    it('pagina por offset, com ativos e inativos', async () => {
      const { servico, db } = criarServico()
      db.banner.findMany.mockResolvedValue([linha({ ativo: false })])
      db.banner.count.mockResolvedValue(21)

      const resposta = await servico.listar({ page: 2, limit: 20 })

      expect(resposta).toMatchObject({ page: 2, limit: 20, total: 21 })
      expect(resposta.items[0]).toMatchObject({ ativo: false, criadoEm: DATA.toISOString() })
      expect(db.banner.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      )
    })
  })

  describe('detalhar', () => {
    it('não encontrado → 404', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(servico.detalhar(ID)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })
  })

  describe('criar', () => {
    it('vai para o fim da ordem, valida a imagem e audita sem a chave', async () => {
      const { servico, tx, uploads, auditado } = criarServico({ ultimaOrdem: 4 })

      const criado = await servico.criar(DIRETOR, { titulo: 'JUBS', imagemKey: IMAGEM })

      expect(criado).toMatchObject({ ordem: 5, ativo: true, link: null })
      expect(uploads.validarKey).toHaveBeenCalledWith({
        key: IMAGEM,
        finalidade: 'BANNER',
        usuarioId: DIRETOR.id,
        atleticaId: ATLETICA_ID,
      })
      expect(tx.$executeRaw).toHaveBeenCalled()
      expect(auditado()).toEqual([
        {
          acao: 'BANNER_CRIADO',
          entidadeId: ID,
          dados: { antes: null, depois: { titulo: 'JUBS', link: null, ordem: 5, ativo: true } },
        },
      ])
    })

    it('primeiro banner fica com ordem 0', async () => {
      const { servico } = criarServico()
      await expect(
        servico.criar(DIRETOR, { titulo: 'JUBS', imagemKey: IMAGEM }),
      ).resolves.toMatchObject({ ordem: 0 })
    })

    it('11º ativo → 409 LIMITE_BANNERS_ATIVOS, sem gravar', async () => {
      const { servico, tx } = criarServico({ ativos: 10 })
      await expect(
        servico.criar(DIRETOR, { titulo: 'JUBS', imagemKey: IMAGEM }),
      ).rejects.toMatchObject({ statusCode: 409, code: 'LIMITE_BANNERS_ATIVOS' })
      expect(tx.banner.create).not.toHaveBeenCalled()
    })

    it('inativo não conta para o limite', async () => {
      const { servico, tx } = criarServico({ ativos: 10 })
      await servico.criar(DIRETOR, { titulo: 'JUBS', imagemKey: IMAGEM, ativo: false })
      expect(tx.banner.count).not.toHaveBeenCalled()
    })

    it('imagem inválida interrompe antes da transação', async () => {
      const { servico, uploads, tx } = criarServico()
      uploads.validarKey.mockRejectedValue(new Error('UPLOAD_INVALIDO'))
      await expect(servico.criar(DIRETOR, { titulo: 'JUBS', imagemKey: IMAGEM })).rejects.toThrow()
      expect(tx.banner.create).not.toHaveBeenCalled()
    })
  })

  describe('atualizar', () => {
    it('sem mudança efetiva: não grava nem audita', async () => {
      const { servico, tx, auditado, uploads } = criarServico()
      await servico.atualizar(ID, DIRETOR, { titulo: 'Inscrições abertas', imagemKey: IMAGEM })
      expect(tx.banner.update).not.toHaveBeenCalled()
      expect(auditado()).toEqual([])
      expect(uploads.validarKey).not.toHaveBeenCalled()
    })

    it('só campos alterados; desativar entra em BANNER_ALTERADO', async () => {
      const { servico, auditado } = criarServico()
      await servico.atualizar(ID, DIRETOR, { ativo: false, link: 'https://exemplo.com' })
      expect(auditado()).toEqual([
        {
          acao: 'BANNER_ALTERADO',
          entidadeId: ID,
          dados: {
            antes: { link: null, ativo: true },
            depois: { link: 'https://exemplo.com', ativo: false },
          },
        },
      ])
    })

    it('troca de imagem: valida a nova, audita só o indicador e remove a anterior após o commit', async () => {
      const { servico, uploads, auditado } = criarServico()
      await servico.atualizar(ID, DIRETOR, { imagemKey: IMAGEM_NOVA })

      expect(uploads.validarKey).toHaveBeenCalledTimes(1)
      expect(uploads.validarKey).toHaveBeenCalledWith(expect.objectContaining({ key: IMAGEM_NOVA }))
      expect(auditado()[0]?.dados).toEqual({ antes: {}, depois: { imagemAlterada: true } })
      expect(uploads.remover).not.toHaveBeenCalled()
      await Promise.all(callbacksAposCommit.map((callback) => callback()))
      expect(uploads.remover).toHaveBeenCalledWith(IMAGEM)
    })

    it('ativar o 11º → 409', async () => {
      const { servico } = criarServico({ atual: linha({ ativo: false }), ativos: 10 })
      await expect(servico.atualizar(ID, DIRETOR, { ativo: true })).rejects.toMatchObject({
        code: 'LIMITE_BANNERS_ATIVOS',
      })
    })

    it('editar um ativo com 10 ativos não esbarra no limite', async () => {
      const { servico, tx } = criarServico({ ativos: 10 })
      await servico.atualizar(ID, DIRETOR, { titulo: 'Novo título' })
      expect(tx.banner.count).not.toHaveBeenCalled()
    })

    it('de outra atlética ou inexistente → 404', async () => {
      const { servico } = criarServico({ atual: null })
      await expect(servico.atualizar(ID, DIRETOR, { titulo: 'Novo' })).rejects.toMatchObject({
        statusCode: 404,
      })
    })
  })

  describe('ordenar', () => {
    it('regrava 0..n-1 e audita um único BANNER_REORDENADO', async () => {
      const { servico, tx, auditado } = criarServico({ ids: [ID, OUTRO, TERCEIRO] })

      await servico.ordenar(DIRETOR, [TERCEIRO, ID, OUTRO])

      const chamadas = tx.banner.update.mock.calls as [{ where: unknown; data: unknown }][]
      expect(chamadas.map(([{ where, data }]) => [where, data])).toEqual([
        [{ id: TERCEIRO }, { ordem: 0 }],
        [{ id: ID }, { ordem: 1 }],
        [{ id: OUTRO }, { ordem: 2 }],
      ])
      expect(auditado()).toEqual([
        {
          acao: 'BANNER_REORDENADO',
          entidadeId: TERCEIRO,
          dados: { antes: { ids: [ID, OUTRO, TERCEIRO] }, depois: { ids: [TERCEIRO, ID, OUTRO] } },
        },
      ])
    })

    it('mesma ordem: não grava nem audita', async () => {
      const { servico, tx, auditado } = criarServico({ ids: [ID, OUTRO] })
      await servico.ordenar(DIRETOR, [ID, OUTRO])
      expect(tx.banner.update).not.toHaveBeenCalled()
      expect(auditado()).toEqual([])
    })

    it.each([
      ['faltando', [ID]],
      ['sobrando', [ID, OUTRO, TERCEIRO]],
      ['repetido', [ID, ID]],
      ['de outra atlética', [ID, TERCEIRO]],
    ])('lista %s → 400 ORDEM_INCOMPLETA', async (_, ids) => {
      const { servico, tx } = criarServico({ ids: [ID, OUTRO] })
      await expect(servico.ordenar(DIRETOR, ids)).rejects.toMatchObject({
        statusCode: 400,
        code: 'ORDEM_INCOMPLETA',
      })
      expect(tx.banner.update).not.toHaveBeenCalled()
    })
  })

  describe('excluir', () => {
    it('exclusão física, audita com depois: null e mantém a imagem no R2', async () => {
      const { servico, tx, uploads, auditado } = criarServico()
      await servico.excluir(ID, DIRETOR)
      expect(tx.banner.delete).toHaveBeenCalledWith({ where: { id: ID } })
      expect(auditado()).toEqual([
        {
          acao: 'BANNER_EXCLUIDO',
          entidadeId: ID,
          dados: {
            antes: { titulo: 'Inscrições abertas', link: null, ordem: 0, ativo: true },
            depois: null,
          },
        },
      ])
      expect(callbacksAposCommit).toEqual([])
      expect(uploads.remover).not.toHaveBeenCalled()
    })

    it('inexistente → 404', async () => {
      const { servico, tx } = criarServico({ atual: null })
      await expect(servico.excluir(ID, DIRETOR)).rejects.toMatchObject({ statusCode: 404 })
      expect(tx.banner.delete).not.toHaveBeenCalled()
    })
  })
})
