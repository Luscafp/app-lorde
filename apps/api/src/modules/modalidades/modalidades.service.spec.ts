import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { ModalidadesService } from './modalidades.service'

const ID = '6f1c2a7e-2f5b-4c39-9a0e-3f3b1b8d2c11'
const FUTSAL = { id: ID, nome: 'futsal', icone: 'soccer', ativa: true }

function erroPrisma(code: string) {
  return new PrismaClientKnownRequestError('falha', { code, clientVersion: '7' })
}

function criarServico({ times = 0, atual = FUTSAL } = {}) {
  const tx = {
    modalidade: {
      findUnique: jest.fn().mockResolvedValue(atual),
      create: jest.fn(({ data }: { data: object }) =>
        Promise.resolve({ id: ID, ativa: true, ...data }),
      ),
      update: jest.fn(({ data }: { data: object }) => Promise.resolve({ ...atual, ...data })),
      delete: jest.fn().mockResolvedValue(atual),
    },
    time: { count: jest.fn().mockResolvedValue(times) },
  }
  const db = {
    modalidade: { findMany: jest.fn() },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const auditoria = { registrar: jest.fn(), registrarVarios: jest.fn() }
  const servico = new ModalidadesService(
    { db } as unknown as PrismaService,
    auditoria as unknown as AuditoriaService,
  )
  return { servico, tx, db, auditoria }
}

describe('ModalidadesService', () => {
  describe('listar', () => {
    it('ordena por nome sem diferenciar maiúsculas e acentos', async () => {
      const { servico, db } = criarServico()
      db.modalidade.findMany.mockResolvedValue([
        { nome: 'vôlei' },
        { nome: 'Xadrez' },
        { nome: 'Basquete' },
        { nome: 'E-sports' },
      ])
      const nomes = (await servico.listar(false)).map(({ nome }) => nome)
      expect(nomes).toEqual(['Basquete', 'E-sports', 'vôlei', 'Xadrez'])
      expect(db.modalidade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { ativa: true } }),
      )
    })

    it('incluirInativas não filtra por ativa', async () => {
      const { servico, db } = criarServico()
      db.modalidade.findMany.mockResolvedValue([])
      await servico.listar(true)
      expect(db.modalidade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined }),
      )
    })
  })

  describe('criar', () => {
    it('normaliza o nome e audita na mesma transação', async () => {
      const { servico, tx, auditoria } = criarServico()
      const criada = await servico.criar({ nome: '  Vôlei   de  Praia ', icone: 'volleyball' })

      expect(criada.nome).toBe('Vôlei de Praia')
      expect(tx.modalidade.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { nome: 'Vôlei de Praia', icone: 'volleyball' } }),
      )
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Modalidade',
        acao: 'MODALIDADE_CRIADA',
        entidadeId: ID,
        dados: {
          antes: null,
          depois: { nome: 'Vôlei de Praia', icone: 'volleyball', ativa: true },
        },
      })
    })

    it('P2002 do índice único (outra caixa ou corrida) → 409 MODALIDADE_DUPLICADA', async () => {
      const { servico, tx } = criarServico()
      tx.modalidade.create.mockRejectedValue(erroPrisma('P2002'))
      await expect(servico.criar({ nome: 'FUTSAL', icone: 'soccer' })).rejects.toMatchObject({
        statusCode: 409,
        code: 'MODALIDADE_DUPLICADA',
        details: [{ field: 'nome' }],
      })
    })
  })

  describe('atualizar', () => {
    it('aceita renomear só a caixa do próprio nome e audita só o que mudou', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.atualizar(ID, { nome: 'Futsal', icone: 'soccer' })

      expect(tx.modalidade.update).toHaveBeenCalled()
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        {
          entidade: 'Modalidade',
          entidadeId: ID,
          acao: 'MODALIDADE_ALTERADA',
          dados: { antes: { nome: 'futsal' }, depois: { nome: 'Futsal' } },
        },
      ])
    })

    it.each([
      [true, false, 'MODALIDADE_DESATIVADA'],
      [false, true, 'MODALIDADE_ATIVADA'],
    ])('ativa %s → %s registra %s', async (antes, depois, acao) => {
      const { servico, tx, auditoria } = criarServico({ atual: { ...FUTSAL, ativa: antes } })
      await servico.atualizar(ID, { ativa: depois })
      expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
        expect.objectContaining({
          acao,
          dados: { antes: { ativa: antes }, depois: { ativa: depois } },
        }),
      ])
    })

    it('nome e ativa no mesmo PATCH geram ALTERADA e DESATIVADA', async () => {
      const { servico, auditoria } = criarServico()
      await servico.atualizar(ID, { nome: 'Futebol de Salão', ativa: false })
      const [, entradas] = auditoria.registrarVarios.mock.calls[0] as [unknown, { acao: string }[]]
      expect(entradas.map(({ acao }) => acao)).toEqual([
        'MODALIDADE_ALTERADA',
        'MODALIDADE_DESATIVADA',
      ])
    })

    it('sem mudança devolve a modalidade sem gravar nem auditar', async () => {
      const { servico, tx, auditoria } = criarServico()
      await expect(servico.atualizar(ID, { ativa: true, icone: 'soccer' })).resolves.toEqual(FUTSAL)
      expect(tx.modalidade.update).not.toHaveBeenCalled()
      expect(auditoria.registrarVarios).not.toHaveBeenCalled()
    })

    it('inexistente → 404 NOT_FOUND', async () => {
      const { servico, tx } = criarServico()
      tx.modalidade.findUnique.mockResolvedValue(null)
      await expect(servico.atualizar(ID, { ativa: false })).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      })
    })

    it('nome de outra modalidade (P2002) → 409 MODALIDADE_DUPLICADA', async () => {
      const { servico, tx } = criarServico()
      tx.modalidade.update.mockRejectedValue(erroPrisma('P2002'))
      await expect(servico.atualizar(ID, { nome: 'Vôlei' })).rejects.toMatchObject({
        code: 'MODALIDADE_DUPLICADA',
      })
    })
  })

  describe('excluir', () => {
    it('sem times: exclui e audita com depois: null', async () => {
      const { servico, tx, auditoria } = criarServico()
      await servico.excluir(ID)
      expect(tx.modalidade.delete).toHaveBeenCalledWith({ where: { id: ID } })
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Modalidade',
        acao: 'MODALIDADE_EXCLUIDA',
        entidadeId: ID,
        dados: { antes: { nome: 'futsal', icone: 'soccer', ativa: true }, depois: null },
      })
    })

    it('com times → 409 MODALIDADE_COM_DEPENDENCIAS sem excluir', async () => {
      const { servico, tx, auditoria } = criarServico({ times: 1 })
      await expect(servico.excluir(ID)).rejects.toMatchObject({
        statusCode: 409,
        code: 'MODALIDADE_COM_DEPENDENCIAS',
      })
      expect(tx.modalidade.delete).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('P2003 (time fora do escopo) → 409 MODALIDADE_COM_DEPENDENCIAS', async () => {
      const { servico, tx } = criarServico()
      tx.modalidade.delete.mockRejectedValue(erroPrisma('P2003'))
      await expect(servico.excluir(ID)).rejects.toMatchObject({
        code: 'MODALIDADE_COM_DEPENDENCIAS',
      })
    })

    it('outros erros do Prisma seguem sem tradução', async () => {
      const { servico, tx } = criarServico()
      const erro = erroPrisma('P2025')
      tx.modalidade.delete.mockRejectedValue(erro)
      await expect(servico.excluir(ID)).rejects.toBe(erro)
    })
  })
})
