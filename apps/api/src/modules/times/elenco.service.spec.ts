import type { ErroNegocio } from '../../common/erros/erro-negocio'
import type { PrismaService, TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { UploadsService } from '../uploads/uploads.service'
import { ElencoService, MotivoSaida } from './elenco.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const ANA = 'u1u1u1u1-0000-4000-8000-000000000001'
const BRUNO = 'u2u2u2u2-0000-4000-8000-000000000002'
const DIRETOR = 'u9u9u9u9-0000-4000-8000-000000000009'
const MEMBRO = 'm1m1m1m1-0000-4000-8000-000000000001'
const AGORA_DO_BANCO = new Date('2026-09-01T12:00:00.000Z')

interface Cenario {
  usaAplicativo?: boolean | null
  capitaoId?: string | null
  membroAtivo?: boolean
  participacoes?: number
  membros?: object[]
}

function linhaTime(capitaoId: string | null) {
  return {
    id: TIME,
    nome: 'Futsal Masculino',
    ativo: true,
    atleticaId: ATUAL,
    modalidadeId: 'c1',
    modalidade: { id: 'c1', nome: 'Futsal', icone: 'soccer' },
    atletica: { id: ATUAL, nome: 'Atlética', sigla: 'ATL' },
    capitao: capitaoId && { id: capitaoId, nome: 'Bruno' },
    _count: { membros: 2 },
  }
}

function criarServico(cenario: Cenario = {}) {
  const { usaAplicativo = true, capitaoId = ANA, membroAtivo = true } = cenario
  const time = usaAplicativo === null ? null : { capitaoId, atletica: { usaAplicativo } }
  let capitaoAtual = capitaoId
  const tx = {
    time: {
      findUnique: jest.fn().mockResolvedValue(time),
      findUniqueOrThrow: jest.fn(() => Promise.resolve(linhaTime(capitaoAtual))),
      update: jest.fn(({ data }: { data: { capitaoId: string | null } }) => {
        capitaoAtual = data.capitaoId
        return Promise.resolve({ id: TIME })
      }),
    },
    $queryRaw: jest.fn().mockResolvedValue([{ capitaoId, agora: AGORA_DO_BANCO }]),
    membroTime: {
      updateManyAndReturn: jest.fn().mockResolvedValue(membroAtivo ? [{ id: MEMBRO }] : []),
      count: jest.fn().mockResolvedValue(membroAtivo ? 1 : 0),
    },
    participacao: {
      deleteMany: jest.fn().mockResolvedValue({ count: cenario.participacoes ?? 0 }),
    },
  }
  const db = {
    time: { findFirst: jest.fn().mockResolvedValue(time) },
    membroTime: { findMany: jest.fn().mockResolvedValue(cenario.membros ?? []) },
    $transaction: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  const auditoria = { registrar: jest.fn() }
  const uploads = { urlPublica: jest.fn((key: string | null) => key && `https://img/${key}`) }
  const servico = new ElencoService(
    { db } as unknown as PrismaService,
    auditoria as unknown as AuditoriaService,
    uploads as unknown as UploadsService,
  )
  return { servico, tx, db, auditoria, transacao: tx as unknown as TransacaoComEscopo }
}

async function codigoDe(promessa: Promise<unknown>): Promise<string> {
  const erro = (await promessa.then(
    () => {
      throw new Error('esperava erro')
    },
    (e: unknown) => e,
  )) as ErroNegocio
  return erro.code
}

const ordem = (fn: jest.Mock) => fn.mock.invocationCallOrder[0] ?? Infinity

const encerrar = (motivo: MotivoSaida = MotivoSaida.REMOVIDO_PELA_DIRETORIA) => ({
  timeId: TIME,
  usuarioId: ANA,
  motivo,
  executorId: DIRETOR,
})

describe('ElencoService', () => {
  describe('encerrarVinculo', () => {
    it('trava o time antes de preencher saidaEm com o now() do banco só no vínculo ativo', async () => {
      const { servico, tx, transacao } = criarServico()
      await servico.encerrarVinculo(transacao, encerrar())

      const [partes] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray]
      expect(partes.join('?')).toContain('FOR UPDATE')
      expect(ordem(tx.$queryRaw)).toBeLessThan(ordem(tx.membroTime.updateManyAndReturn))
      expect(tx.membroTime.updateManyAndReturn).toHaveBeenCalledWith({
        where: { timeId: TIME, usuarioId: ANA, saidaEm: null },
        data: { saidaEm: AGORA_DO_BANCO },
        select: { id: true },
      })
    })

    it('capitão: limpa a capitania', async () => {
      const { servico, tx, transacao } = criarServico({ capitaoId: ANA })
      const resultado = await servico.encerrarVinculo(transacao, encerrar())

      expect(resultado.capitaniaRemovida).toBe(true)
      expect(tx.time.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TIME }, data: { capitaoId: null } }),
      )
    })

    it('não capitão: mantém a capitania', async () => {
      const { servico, tx, transacao } = criarServico({ capitaoId: BRUNO })
      const resultado = await servico.encerrarVinculo(transacao, encerrar())

      expect(resultado.capitaniaRemovida).toBe(false)
      expect(tx.time.update).not.toHaveBeenCalled()
    })

    it('apaga só participações AGENDADO futuras sem presença do time', async () => {
      const { servico, tx, transacao } = criarServico({ participacoes: 2 })
      const resultado = await servico.encerrarVinculo(transacao, encerrar())

      expect(resultado.participacoesRemovidas).toBe(2)
      expect(tx.participacao.deleteMany).toHaveBeenCalledWith({
        where: {
          usuarioId: ANA,
          presente: null,
          evento: { timeId: TIME, status: 'AGENDADO', inicio: { gt: AGORA_DO_BANCO } },
        },
      })
    })

    it.each([
      [MotivoSaida.REMOVIDO_PELA_DIRETORIA, 'MEMBRO_REMOVIDO'],
      [MotivoSaida.SAIU, 'MEMBRO_SAIU'],
      [MotivoSaida.EXCLUSAO_CONTA, 'MEMBRO_REMOVIDO_EXCLUSAO_CONTA'],
    ])('motivo %s → auditoria %s no mesmo tx, ator = executor', async (motivo, acao) => {
      const { servico, auditoria, transacao } = criarServico({ participacoes: 1 })
      await servico.encerrarVinculo(transacao, encerrar(motivo))

      expect(auditoria.registrar).toHaveBeenCalledWith(transacao, {
        entidade: 'MembroTime',
        acao,
        entidadeId: MEMBRO,
        usuarioId: DIRETOR,
        dados: {
          antes: { saidaEm: null },
          depois: { saidaEm: AGORA_DO_BANCO },
          contexto: {
            timeId: TIME,
            usuarioId: ANA,
            capitaniaRemovida: true,
            participacoesRemovidas: 1,
          },
        },
      })
    })

    it('sem vínculo ativo → MEMBRO_NAO_ENCONTRADO, sem auditoria', async () => {
      const { servico, tx, auditoria, transacao } = criarServico({ membroAtivo: false })
      await expect(codigoDe(servico.encerrarVinculo(transacao, encerrar()))).resolves.toBe(
        'MEMBRO_NAO_ENCONTRADO',
      )
      expect(tx.participacao.deleteMany).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('time adversário → TIME_ADVERSARIO; inexistente → NOT_FOUND', async () => {
      const adversario = criarServico({ usaAplicativo: false })
      await expect(
        codigoDe(adversario.servico.encerrarVinculo(adversario.transacao, encerrar())),
      ).resolves.toBe('TIME_ADVERSARIO')
      expect(adversario.tx.$queryRaw).not.toHaveBeenCalled()

      const inexistente = criarServico({ usaAplicativo: null })
      await expect(
        codigoDe(inexistente.servico.encerrarVinculo(inexistente.transacao, encerrar())),
      ).resolves.toBe('NOT_FOUND')
    })

    it('time apagado entre a leitura e a trava → NOT_FOUND', async () => {
      const { servico, tx, transacao } = criarServico()
      tx.$queryRaw.mockResolvedValueOnce([])
      await expect(codigoDe(servico.encerrarVinculo(transacao, encerrar()))).resolves.toBe(
        'NOT_FOUND',
      )
    })
  })

  describe('removerMembro', () => {
    it('encerra com REMOVIDO_PELA_DIRETORIA numa transação', async () => {
      const { servico, db, auditoria } = criarServico()
      await servico.removerMembro(TIME, ANA, DIRETOR)

      expect(db.$transaction).toHaveBeenCalledTimes(1)
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ acao: 'MEMBRO_REMOVIDO', usuarioId: DIRETOR }),
      )
    })
  })

  describe('sair', () => {
    it('encerra com SAIU e o próprio usuário como executor; devolve o resumo', async () => {
      const { servico, db, auditoria } = criarServico({ capitaoId: ANA, participacoes: 2 })
      const saida = await servico.sair(TIME, ANA)

      expect(db.$transaction).toHaveBeenCalledTimes(1)
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ acao: 'MEMBRO_SAIU', usuarioId: ANA }),
      )
      expect(saida).toEqual({
        timeId: TIME,
        saidaEm: AGORA_DO_BANCO.toISOString(),
        capitaniaRemovida: true,
        participacoesRemovidas: 2,
      })
    })

    it('sem vínculo ativo → 409 NAO_E_MEMBRO', async () => {
      const { servico } = criarServico({ membroAtivo: false })
      const erro = await servico.sair(TIME, ANA).catch((e: unknown) => e as ErroNegocio)
      expect(erro).toMatchObject({ statusCode: 409, code: 'NAO_E_MEMBRO' })
    })

    it('time adversário → TIME_ADVERSARIO; inexistente → NOT_FOUND', async () => {
      await expect(
        codigoDe(criarServico({ usaAplicativo: false }).servico.sair(TIME, ANA)),
      ).resolves.toBe('TIME_ADVERSARIO')
      await expect(
        codigoDe(criarServico({ usaAplicativo: null }).servico.sair(TIME, ANA)),
      ).resolves.toBe('NOT_FOUND')
    })
  })

  describe('definirCapitao', () => {
    it('membro ativo: troca o capitão, trava antes de checar o vínculo e audita', async () => {
      const { servico, tx, auditoria } = criarServico({ capitaoId: ANA })
      const time = await servico.definirCapitao(TIME, BRUNO, ATUAL)

      expect(ordem(tx.$queryRaw)).toBeLessThan(ordem(tx.membroTime.count))
      expect(tx.time.update).toHaveBeenCalledWith({
        where: { id: TIME },
        data: { capitaoId: BRUNO },
      })
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.anything(), {
        entidade: 'Time',
        acao: 'CAPITAO_DEFINIDO',
        entidadeId: TIME,
        dados: { antes: { capitaoId: ANA }, depois: { capitaoId: BRUNO } },
      })
      expect(time.capitao).toEqual({ id: BRUNO, nome: 'Bruno' })
    })

    it('ex-membro ou não membro → CAPITAO_FORA_DO_ELENCO', async () => {
      const { servico, tx, auditoria } = criarServico({ membroAtivo: false })
      await expect(codigoDe(servico.definirCapitao(TIME, BRUNO, ATUAL))).resolves.toBe(
        'CAPITAO_FORA_DO_ELENCO',
      )
      expect(tx.time.update).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('null remove o capitão sem checar elenco: CAPITAO_REMOVIDO', async () => {
      const { servico, tx, auditoria } = criarServico({ capitaoId: ANA })
      const time = await servico.definirCapitao(TIME, null, ATUAL)

      expect(tx.membroTime.count).not.toHaveBeenCalled()
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          acao: 'CAPITAO_REMOVIDO',
          dados: { antes: { capitaoId: ANA }, depois: { capitaoId: null } },
        }),
      )
      expect(time.capitao).toBeNull()
    })

    it.each([ANA, null])('sem mudança (%s) → devolve o time sem gravar nem auditar', async (id) => {
      const { servico, tx, auditoria } = criarServico({ capitaoId: id })
      await servico.definirCapitao(TIME, id, ATUAL)

      expect(tx.time.update).not.toHaveBeenCalled()
      expect(auditoria.registrar).not.toHaveBeenCalled()
    })

    it('time adversário → TIME_ADVERSARIO', async () => {
      const { servico } = criarServico({ usaAplicativo: false })
      await expect(codigoDe(servico.definirCapitao(TIME, BRUNO, ATUAL))).resolves.toBe(
        'TIME_ADVERSARIO',
      )
    })
  })

  describe('listar', () => {
    const membro = (id: string, nome: string, extra: object = {}) => ({
      entradaEm: new Date('2026-08-10T13:00:00.000Z'),
      usuario: { id, nome, fotoKey: `f/${id}`, excluidoEm: null, ...extra },
    })

    it('capitão primeiro, depois por nome sem acento nem caixa; sem e-mail', async () => {
      const { servico } = criarServico({
        capitaoId: BRUNO,
        membros: [membro(ANA, 'ana'), membro('u3', 'Érica'), membro(BRUNO, 'Zeca')],
      })
      const elenco = await servico.listar(TIME, false)

      expect(elenco.total).toBe(3)
      expect(elenco.items.map(({ nome, capitao }) => [nome, capitao])).toEqual([
        ['Zeca', true],
        ['ana', false],
        ['Érica', false],
      ])
      expect(elenco.items[0]).toEqual({
        usuarioId: BRUNO,
        nome: 'Zeca',
        fotoUrl: `https://img/f/${BRUNO}`,
        entradaEm: '2026-08-10T13:00:00.000Z',
        capitao: true,
      })
    })

    it('usuário excluído aparece como "Usuário excluído" sem foto', async () => {
      const { servico } = criarServico({
        membros: [membro(BRUNO, 'Bruno', { excluidoEm: new Date() })],
      })
      const [item] = (await servico.listar(TIME, false)).items
      expect(item).toMatchObject({ nome: 'Usuário excluído', fotoUrl: null })
    })

    it('fora da Diretoria só vê time ativo de modalidade ativa', async () => {
      const { servico, db } = criarServico()
      await servico.listar(TIME, false)
      await servico.listar(TIME, true)

      expect(db.time.findFirst.mock.calls.map(([{ where }]) => where as unknown)).toEqual([
        { id: TIME, ativo: true, modalidade: { ativa: true } },
        { id: TIME },
      ])
    })

    it('adversário → TIME_ADVERSARIO; inexistente → NOT_FOUND', async () => {
      await expect(
        codigoDe(criarServico({ usaAplicativo: false }).servico.listar(TIME, true)),
      ).resolves.toBe('TIME_ADVERSARIO')
      await expect(
        codigoDe(criarServico({ usaAplicativo: null }).servico.listar(TIME, true)),
      ).resolves.toBe('NOT_FOUND')
    })
  })
})
