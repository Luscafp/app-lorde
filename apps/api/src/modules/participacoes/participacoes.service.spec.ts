import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosLeituraService } from '../eventos/eventos-leitura.service'
import { ParticipacoesService } from './participacoes.service'

const ATUAL = 'a1a1a1a1-0000-4000-8000-000000000001'
const EVENTO = 'e1e1e1e1-0000-4000-8000-000000000001'
const TIME = 'b1b1b1b1-0000-4000-8000-000000000001'
const EU = { id: 'c1c1c1c1-0000-4000-8000-000000000001', atleticaId: ATUAL }
const INICIO = new Date('2026-10-11T03:30:00.000Z')
const AGORA = new Date(INICIO.getTime() - 60 * 60 * 1000)
const ANTES = new Date('2026-10-01T12:00:00.000Z')
const CONTAGEM = { confirmados: 1, recusados: 0, semResposta: 2, elenco: 3 }

type Status = 'AGENDADO' | 'EM_ANDAMENTO' | 'FINALIZADO' | 'CANCELADO'

interface Cenario {
  evento?: { status?: Status } | null
  membro?: boolean
  atual?: { confirmado: boolean | null; respondidoEm: Date | null } | null
}

function erroPrisma(code: string) {
  return new PrismaClientKnownRequestError('falha', { code, clientVersion: '7' })
}

function criarServico(cenario: Cenario = {}) {
  const evento =
    cenario.evento === null
      ? null
      : { id: EVENTO, status: cenario.evento?.status ?? 'AGENDADO', inicio: INICIO, timeId: TIME }
  const tx = {
    evento: { findFirst: jest.fn().mockResolvedValue(evento) },
    membroTime: { count: jest.fn().mockResolvedValue(cenario.membro === false ? 0 : 1) },
    participacao: {
      findUnique: jest.fn().mockResolvedValue(cenario.atual ?? null),
      upsert: jest.fn(({ update }: { update: { confirmado: boolean; respondidoEm: Date } }) =>
        Promise.resolve(update),
      ),
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const leitura = { contagem: jest.fn().mockResolvedValue(CONTAGEM) }
  const servico = new ParticipacoesService(
    transacao as unknown as TransacaoService,
    leitura as unknown as EventosLeituraService,
  )
  return { servico, tx, transacao, leitura }
}

describe('ParticipacoesService', () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA, doNotFake: ['nextTick', 'setImmediate'] })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('primeira resposta grava com o usuário do token e devolve a contagem do elenco', async () => {
    const { servico, tx, leitura } = criarServico()

    await expect(servico.responder(EVENTO, true, EU)).resolves.toEqual({
      eventoId: EVENTO,
      confirmado: true,
      respondidoEm: AGORA.toISOString(),
      contagem: CONTAGEM,
    })
    expect(tx.participacao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventoId_usuarioId: { eventoId: EVENTO, usuarioId: EU.id } },
        create: {
          atleticaId: ATUAL,
          eventoId: EVENTO,
          usuarioId: EU.id,
          confirmado: true,
          respondidoEm: AGORA,
        },
        update: { confirmado: true, respondidoEm: AGORA },
      }),
    )
    expect(leitura.contagem).toHaveBeenCalledWith({
      id: EVENTO,
      status: 'AGENDADO',
      inicio: INICIO,
      timeId: TIME,
    })
  })

  it('troca de resposta atualiza confirmado e respondidoEm, sem tocar na presença', async () => {
    const { servico, tx } = criarServico({ atual: { confirmado: true, respondidoEm: ANTES } })

    const resposta = await servico.responder(EVENTO, false, EU)

    expect(resposta).toMatchObject({ confirmado: false, respondidoEm: AGORA.toISOString() })
    expect(tx.participacao.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { confirmado: false, respondidoEm: AGORA } }),
    )
  })

  it('mesma resposta é idempotente: não grava e mantém respondidoEm', async () => {
    const { servico, tx } = criarServico({ atual: { confirmado: true, respondidoEm: ANTES } })

    await expect(servico.responder(EVENTO, true, EU)).resolves.toMatchObject({
      confirmado: true,
      respondidoEm: ANTES.toISOString(),
    })
    expect(tx.participacao.upsert).not.toHaveBeenCalled()
  })

  it('linha só com presença (sem resposta) recebe a primeira resposta', async () => {
    const { servico, tx } = criarServico({ atual: { confirmado: null, respondidoEm: null } })
    await servico.responder(EVENTO, false, EU)
    expect(tx.participacao.upsert).toHaveBeenCalledTimes(1)
  })

  it.each<[string, Cenario, string]>([
    ['evento inexistente, excluído ou de outra atlética', { evento: null }, 'NOT_FOUND'],
    ['fora do elenco (ex-membro, outro time, Diretor)', { membro: false }, 'NAO_MEMBRO_DO_ELENCO'],
    ['cancelado', { evento: { status: 'CANCELADO' } }, 'EVENTO_CANCELADO'],
    ['em andamento', { evento: { status: 'EM_ANDAMENTO' } }, 'EVENTO_NAO_AGENDADO'],
    ['finalizado', { evento: { status: 'FINALIZADO' } }, 'EVENTO_NAO_AGENDADO'],
    [
      'não membro de evento cancelado (ordem de avaliação)',
      { membro: false, evento: { status: 'CANCELADO' } },
      'NAO_MEMBRO_DO_ELENCO',
    ],
  ])('%s → %s, sem gravar', async (_, cenario, codigo) => {
    const { servico, tx } = criarServico(cenario)
    await expect(codigoDaRejeicao(servico.responder(EVENTO, true, EU))).resolves.toBe(codigo)
    expect(tx.participacao.upsert).not.toHaveBeenCalled()
  })

  it('NAO_MEMBRO_DO_ELENCO é 403 e os bloqueios por evento são 422', async () => {
    const naoMembro = criarServico({ membro: false }).servico.responder(EVENTO, true, EU)
    await expect(naoMembro).rejects.toMatchObject({ statusCode: 403 })
    const cancelado = criarServico({ evento: { status: 'CANCELADO' } })
    await expect(cancelado.servico.responder(EVENTO, true, EU)).rejects.toMatchObject({
      statusCode: 422,
    })
  })

  it('aceita até 1 ms antes do início e bloqueia no instante do início', async () => {
    jest.setSystemTime(INICIO.getTime() - 1)
    await expect(criarServico().servico.responder(EVENTO, true, EU)).resolves.toBeDefined()

    jest.setSystemTime(INICIO)
    const { servico, tx } = criarServico()
    await expect(codigoDaRejeicao(servico.responder(EVENTO, true, EU))).resolves.toBe(
      'EVENTO_JA_INICIADO',
    )
    expect(tx.participacao.upsert).not.toHaveBeenCalled()
  })

  it('P2002 (criação concorrente) repete a transação uma vez', async () => {
    const { servico, transacao } = criarServico()
    transacao.executar.mockRejectedValueOnce(erroPrisma('P2002'))

    await expect(servico.responder(EVENTO, true, EU)).resolves.toMatchObject({ confirmado: true })
    expect(transacao.executar).toHaveBeenCalledTimes(2)
  })

  it('outros erros do Prisma passam adiante sem repetir', async () => {
    const { servico, transacao } = criarServico()
    const erro = erroPrisma('P2003')
    transacao.executar.mockRejectedValueOnce(erro)

    await expect(servico.responder(EVENTO, true, EU)).rejects.toBe(erro)
    expect(transacao.executar).toHaveBeenCalledTimes(1)
  })
})
