import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { UploadsService } from '../uploads/uploads.service'
import { PresencasService } from './presencas.service'

const ATLETICA = 'a1a1a1a1-0000-4000-8000-000000000001'
const EVENTO = 'e1e1e1e1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const ANA = 'c1c1c1c1-0000-4000-8000-000000000001'
const BIA = 'c1c1c1c1-0000-4000-8000-000000000002'
const CAIO = 'c1c1c1c1-0000-4000-8000-000000000003'
const EXCLUIDO = 'c1c1c1c1-0000-4000-8000-000000000004'
const DIRETOR = { id: 'd1d1d1d1-0000-4000-8000-000000000001', atleticaId: ATLETICA }
const INICIO = new Date('2026-10-11T22:00:00.000Z')
const REGISTRO = new Date('2026-10-11T23:30:00.000Z')
const AGORA = new Date('2026-10-12T10:00:00.000Z')

type Status = 'AGENDADO' | 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO'

interface Linha {
  usuarioId: string
  confirmado?: boolean | null
  presente?: boolean | null
}

const usuario = (id: string, nome: string, fotoKey: string | null = `fotos/${id}.webp`) => ({
  usuario: { id, nome, fotoKey, excluidoEm: null as Date | null },
})

const MEMBROS = [
  usuario(CAIO, 'Caio Lima'),
  usuario(ANA, 'Ana Souza'),
  usuario(BIA, 'Bia Reis', null),
  { usuario: { id: EXCLUIDO, nome: 'Zé Anonimizado', fotoKey: 'x', excluidoEm: new Date() } },
]

function participacao({ usuarioId, confirmado = null, presente = null }: Linha) {
  return {
    usuarioId,
    confirmado,
    presente,
    presencaRegistradaEm: presente === null ? null : REGISTRO,
  }
}

function criarServico({
  status = 'FINALIZADO',
  existe = true,
  linhas = [],
}: { status?: Status; existe?: boolean; linhas?: Linha[] } = {}) {
  const evento = { id: EVENTO, atleticaId: ATLETICA, status, inicio: INICIO, timeId: TIME }
  const banco = () => ({
    membroTime: { findMany: jest.fn().mockResolvedValue(MEMBROS) },
    participacao: {
      findMany: jest.fn().mockResolvedValue(linhas.map(participacao)),
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  })
  const db = {
    ...banco(),
    evento: { findFirst: jest.fn().mockResolvedValue(existe ? evento : null) },
  }
  const tx = { ...banco(), $queryRaw: jest.fn().mockResolvedValue(existe ? [evento] : []) }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) }
  const uploads = { urlPublica: (key: string | null) => (key ? `https://cdn/${key}` : null) }
  const servico = new PresencasService(
    { db } as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    uploads as unknown as UploadsService,
  )
  return { servico, db, tx, auditoria }
}

const HORA = 60 * 60 * 1000
const antesDoInicio = new Date(INICIO.getTime() - HORA)
const depoisDoInicio = new Date(INICIO.getTime() + HORA)

interface Vinculo {
  entradaEm: Date
  saidaEm: Date | null
}

interface FiltroElenco {
  entradaEm: { lte: Date }
  OR: [{ saidaEm: null }, { saidaEm: { gt: Date } }]
}

function cobreFiltro(where: FiltroElenco, { entradaEm, saidaEm }: Vinculo): boolean {
  const saiuDepois = saidaEm === null || saidaEm > where.OR[1].saidaEm.gt
  return entradaEm <= where.entradaEm.lte && saiuDepois
}

describe('PresencasService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA, doNotFake: ['nextTick', 'setImmediate'] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('listar', () => {
    it('consulta o elenco cujo vínculo cobria o início do evento', async () => {
      const { servico, db } = criarServico()
      await servico.listar(EVENTO)
      expect(db.membroTime.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            timeId: TIME,
            entradaEm: { lte: INICIO },
            OR: [{ saidaEm: null }, { saidaEm: { gt: INICIO } }],
          },
        }),
      )
    })

    it.each<[string, Vinculo, boolean]>([
      ['entrou antes do início, sem saída', { entradaEm: antesDoInicio, saidaEm: null }, true],
      ['entrou no próprio início', { entradaEm: INICIO, saidaEm: null }, true],
      ['entrou depois do início', { entradaEm: depoisDoInicio, saidaEm: null }, false],
      ['saiu antes do início', { entradaEm: antesDoInicio, saidaEm: antesDoInicio }, false],
      ['saiu no próprio início', { entradaEm: antesDoInicio, saidaEm: INICIO }, false],
      ['saiu depois do início', { entradaEm: antesDoInicio, saidaEm: depoisDoInicio }, true],
    ])('elenco do evento: %s → %s', async (_caso, vinculo, noElenco) => {
      const { servico, db } = criarServico()
      await servico.listar(EVENTO)
      const [{ where }] = db.membroTime.findMany.mock.calls[0] as [{ where: FiltroElenco }]
      expect(cobreFiltro(where, vinculo)).toBe(noElenco)
    })

    it('sem chamada: pré-preenche com quem confirmou, etiqueta a resposta e ordena por nome', async () => {
      const { servico } = criarServico({
        linhas: [
          { usuarioId: ANA, confirmado: true },
          { usuarioId: BIA, confirmado: false },
        ],
      })

      await expect(servico.listar(EVENTO)).resolves.toEqual({
        eventoId: EVENTO,
        status: 'FINALIZADO',
        registrada: false,
        registradaEm: null,
        itens: [
          {
            usuarioId: ANA,
            nome: 'Ana Souza',
            fotoUrl: `https://cdn/fotos/${ANA}.webp`,
            resposta: 'CONFIRMOU',
            presente: true,
          },
          { usuarioId: BIA, nome: 'Bia Reis', fotoUrl: null, resposta: 'RECUSOU', presente: false },
          {
            usuarioId: CAIO,
            nome: 'Caio Lima',
            fotoUrl: `https://cdn/fotos/${CAIO}.webp`,
            resposta: 'SEM_RESPOSTA',
            presente: false,
          },
          {
            usuarioId: EXCLUIDO,
            nome: 'Usuário excluído',
            fotoUrl: null,
            resposta: 'SEM_RESPOSTA',
            presente: false,
          },
        ],
      })
    })

    it('com chamada: devolve os valores salvos, não os confirmados', async () => {
      const { servico } = criarServico({
        linhas: [
          { usuarioId: ANA, confirmado: true, presente: false },
          { usuarioId: BIA, confirmado: false, presente: true },
          { usuarioId: CAIO, presente: false },
          { usuarioId: EXCLUIDO, presente: true },
        ],
      })

      const lista = await servico.listar(EVENTO)

      expect(lista).toMatchObject({ registrada: true, registradaEm: REGISTRO.toISOString() })
      expect(lista.itens.filter((item) => item.presente).map((item) => item.usuarioId)).toEqual([
        BIA,
        EXCLUIDO,
      ])
    })

    it('evento inexistente, excluído ou de outra atlética → NOT_FOUND', async () => {
      const { servico } = criarServico({ existe: false })
      await expect(codigoDaRejeicao(servico.listar(EVENTO))).resolves.toBe('NOT_FOUND')
    })
  })

  describe('registrar', () => {
    it('primeira chamada: cria as linhas sem resposta, marca e desmarca o elenco e audita', async () => {
      const { servico, tx, auditoria } = criarServico({
        linhas: [
          { usuarioId: ANA, confirmado: true },
          { usuarioId: BIA, confirmado: true },
        ],
      })
      const registro = { presencaRegistradaEm: AGORA, presencaRegistradaPorId: DIRETOR.id }

      await servico.registrar(EVENTO, [CAIO, ANA], DIRETOR)

      expect(tx.$queryRaw).toHaveBeenCalledTimes(1)
      expect(tx.participacao.createMany).toHaveBeenCalledWith({
        data: [CAIO, EXCLUIDO].map((usuarioId) => ({
          atleticaId: ATLETICA,
          eventoId: EVENTO,
          usuarioId,
          presente: usuarioId === CAIO,
          ...registro,
        })),
        skipDuplicates: true,
      })
      expect(tx.participacao.updateMany.mock.calls).toEqual([
        [
          {
            where: { eventoId: EVENTO, usuarioId: { in: [CAIO, ANA] } },
            data: { presente: true, ...registro },
          },
        ],
        [
          {
            where: { eventoId: EVENTO, usuarioId: { in: [BIA, EXCLUIDO] } },
            data: { presente: false, ...registro },
          },
        ],
      ])
      expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
        entidade: 'Participacao',
        acao: 'PRESENCAS_REGISTRADAS',
        entidadeId: EVENTO,
        dados: { antes: { presentes: [] }, depois: { presentes: [ANA, CAIO] } },
      })
    })

    it('correção: desmarcar todos grava presente = false para o elenco inteiro', async () => {
      const { servico, tx, auditoria } = criarServico({
        linhas: [ANA, BIA, CAIO, EXCLUIDO].map((usuarioId) => ({ usuarioId, presente: true })),
      })

      await servico.registrar(EVENTO, [], DIRETOR)

      expect(tx.participacao.createMany).not.toHaveBeenCalled()
      expect(tx.participacao.updateMany).toHaveBeenCalledTimes(1)
      expect(tx.participacao.updateMany).toHaveBeenCalledWith({
        where: { eventoId: EVENTO, usuarioId: { in: [CAIO, ANA, BIA, EXCLUIDO] } },
        data: { presente: false, presencaRegistradaEm: AGORA, presencaRegistradaPorId: DIRETOR.id },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          dados: {
            antes: { presentes: [ANA, BIA, CAIO, EXCLUIDO] },
            depois: { presentes: [] },
          },
        }),
      )
    })

    it('mesma lista já registrada (em outra ordem) não grava nem audita', async () => {
      const { servico, tx, auditoria } = criarServico({
        linhas: [
          { usuarioId: ANA, presente: true },
          { usuarioId: BIA, presente: true },
          { usuarioId: CAIO, presente: false },
          { usuarioId: EXCLUIDO, presente: false },
        ],
      })

      const lista = await servico.registrar(EVENTO, [BIA, ANA], DIRETOR)

      expect(lista).toMatchObject({ registrada: true, registradaEm: REGISTRO.toISOString() })
      expect(tx.participacao.createMany).not.toHaveBeenCalled()
      expect(tx.participacao.updateMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('linha de quem saiu do elenco não impede o no-op nem entra na auditoria', async () => {
      const ex = 'c1c1c1c1-0000-4000-8000-000000000009'
      const { servico, tx, auditoria } = criarServico({
        linhas: [
          { usuarioId: ANA, presente: true },
          { usuarioId: BIA, presente: false },
          { usuarioId: CAIO, presente: false },
          { usuarioId: EXCLUIDO, presente: false },
          { usuarioId: ex, presente: true },
        ],
      })

      await servico.registrar(EVENTO, [ANA], DIRETOR)
      expect(tx.participacao.updateMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()

      await servico.registrar(EVENTO, [ANA, BIA], DIRETOR)
      expect(auditoria.registrar).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          dados: { antes: { presentes: [ANA] }, depois: { presentes: [ANA, BIA].sort() } },
        }),
      )
    })

    it('sem chamada, enviar exatamente os confirmados ainda registra', async () => {
      const { servico, tx, auditoria } = criarServico({
        linhas: [{ usuarioId: ANA, confirmado: true }],
      })
      await servico.registrar(EVENTO, [], DIRETOR)
      expect(tx.participacao.updateMany).toHaveBeenCalled()
      expect(auditoria.registrar).toHaveBeenCalledTimes(1)
    })

    it.each<[Status, boolean]>([
      ['AGENDADO', false],
      ['EM_ANDAMENTO', true],
      ['FINALIZADO', true],
      ['CANCELADO', false],
    ])('status %s → aceita = %s', async (status, aceita) => {
      const { servico, auditoria } = criarServico({ status })
      const registro = servico.registrar(EVENTO, [ANA], DIRETOR)
      if (aceita) {
        await expect(registro).resolves.toMatchObject({ status })
        expect(auditoria.registrar).toHaveBeenCalledTimes(1)
      } else {
        await expect(codigoDaRejeicao(registro)).resolves.toBe('EVENTO_STATUS_INVALIDO')
        expect(auditoria.registrar).not.toHaveBeenCalled()
      }
    })

    it('id fora do elenco do evento → ATLETA_FORA_DO_ELENCO com details, sem gravar', async () => {
      const { servico, tx } = criarServico()
      const fora = 'f1f1f1f1-0000-4000-8000-000000000001'

      const erro = await servico.registrar(EVENTO, [ANA, fora], DIRETOR).catch((e: unknown) => e)

      expect(erro).toMatchObject({
        statusCode: 422,
        code: 'ATLETA_FORA_DO_ELENCO',
        details: [{ field: 'presentes', message: fora }],
      })
      expect(tx.participacao.createMany).not.toHaveBeenCalled()
      expect(tx.participacao.updateMany).not.toHaveBeenCalled()
    })

    it('evento não encontrado no lock → NOT_FOUND', async () => {
      const { servico } = criarServico({ existe: false })
      await expect(codigoDaRejeicao(servico.registrar(EVENTO, [], DIRETOR))).resolves.toBe(
        'NOT_FOUND',
      )
    })
  })
})
