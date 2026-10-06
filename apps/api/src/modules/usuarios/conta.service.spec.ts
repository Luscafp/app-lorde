import { Papel } from '@atletica/shared'
import { ErroLimiteExcedido, ErroNegocio } from '../../common/erros/erro-negocio'
import type { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import type { SenhaService } from '../../infra/senha/senha.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import type { RateLimitService } from '../auth/rate-limit.service'
import type { SessaoService } from '../auth/sessao.service'
import type { ElencoService } from '../times/elenco.service'
import type { UploadsService } from '../uploads/uploads.service'
import { ContaService, emailAnonimo, NOME_ANONIMO, SENHA_HASH_INVALIDO } from './conta.service'
import { erroUltimoAdministrador } from './erros'
import { bloquearPapeis, garantirNaoUltimoAdministrador } from './regras-papel'

const callbacksAposCommit: (() => unknown)[] = []

jest.mock('../../infra/eventos/apos-commit', () => ({
  aposCommit: (callback: () => unknown) => callbacksAposCommit.push(callback),
}))
jest.mock('./regras-papel')

const ID = '6b0e2a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const LORDE = 'a0000000-0000-4000-8000-000000000000'
const OUTRA = 'b0000000-0000-4000-8000-000000000000'
const FOTO = `usuarios/${ID}/perfil/foto.jpg`

interface Vinculo {
  atleticaId: string
  papel: Papel
  ativo: boolean
}

interface Opcoes {
  vinculos?: Vinculo[]
  senhaConfere?: boolean
  timesPorAtletica?: Record<string, string[]>
}

/** Cada mock anota `passo@atlética do contexto` em `ordem`. */
function criarServico({
  vinculos = [{ atleticaId: LORDE, papel: Papel.ATLETA, ativo: true }],
  senhaConfere = true,
  timesPorAtletica = { [LORDE]: ['t2', 't1'] },
}: Opcoes = {}) {
  const ordem: string[] = []
  let atletica: string | undefined
  const anotar = (passo: string) => ordem.push(`${passo}@${atletica ?? '-'}`)
  const passo = (nome: string) => () => {
    anotar(nome)
    return Promise.resolve()
  }
  const responder =
    <A extends unknown[], R>(nome: string, resposta: (...args: A) => R) =>
    (...args: A) => {
      anotar(nome)
      return Promise.resolve(resposta(...args))
    }

  const tx = {
    $queryRaw: jest
      .fn()
      .mockResolvedValueOnce([{ email: 'ana@ex.com', fotoKey: FOTO }])
      .mockResolvedValueOnce(vinculos),
    membroTime: {
      findMany: responder('membros', () =>
        [...(timesPorAtletica[atletica ?? ''] ?? [])].sort().map((timeId) => ({ timeId })),
      ),
    },
    solicitacaoEntrada: { updateMany: passo('solicitacoes') },
    vinculoAtletica: { updateMany: passo('vinculos') },
    usuario: { update: jest.fn(passo('anonimizar')) },
    codigoVerificacao: { deleteMany: passo('codigos') },
    preferenciaNotificacao: { deleteMany: passo('preferencia') },
    dispositivoPush: { deleteMany: passo('dispositivos') },
    tentativaAcesso: { deleteMany: jest.fn(passo('tentativas')) },
  }
  jest.mocked(bloquearPapeis).mockImplementation(passo('lock'))
  jest.mocked(garantirNaoUltimoAdministrador).mockImplementation(passo('rn08'))

  const prisma = {
    semEscopo: {
      usuario: {
        findUnique: jest.fn().mockResolvedValue({ senhaHash: 'hash' }),
      },
    },
  }
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const contexto = {
    executarComAtletica: jest.fn(async (id: string, fn: () => Promise<unknown>) => {
      atletica = id
      try {
        return await fn()
      } finally {
        atletica = undefined
      }
    }),
  }
  const senhas = { verificar: jest.fn().mockResolvedValue(senhaConfere) }
  const limites = {
    verificar: jest.fn().mockResolvedValue(4),
    registrar: jest.fn(),
    limparPorPrefixo: jest.fn(passo('limparLogin')),
  }
  const sessoes = { revogarTodas: jest.fn(responder('sessoes', () => ['s1', 's2'])) }
  const elenco = {
    encerrarVinculo: jest.fn(
      responder('encerrar', (_tx: unknown, { timeId }: { timeId: string }) => {
        ordem.push(`time:${timeId}`)
      }),
    ),
  }
  const auditoria = { registrar: jest.fn(passo('auditoria')) }
  const uploads = { remover: jest.fn() }
  const eventos = { emitirAposCommit: jest.fn() }

  const servico = new ContaService(
    prisma as unknown as PrismaService,
    transacao as unknown as TransacaoService,
    contexto as unknown as ContextoAtletica,
    senhas as unknown as SenhaService,
    limites as unknown as RateLimitService,
    sessoes as unknown as SessaoService,
    elenco as unknown as ElencoService,
    auditoria as unknown as AuditoriaService,
    uploads as unknown as UploadsService,
    eventos as unknown as EventosDominioService,
  )
  return { servico, ordem, tx, transacao, limites, sessoes, elenco, auditoria, uploads, eventos }
}

async function codigo(promessa: Promise<unknown>): Promise<string> {
  const erro: unknown = await promessa.catch((e: unknown) => e)
  if (erro instanceof ErroNegocio) return erro.code
  throw new Error(`esperava ErroNegocio, recebeu ${String(erro)}`)
}

describe('emailAnonimo', () => {
  it('único por conta e não entregável', () => {
    expect(emailAnonimo(ID)).toBe(`excluido+${ID}@anonimo.invalid`)
    expect(emailAnonimo(LORDE)).not.toBe(emailAnonimo(ID))
  })
})

describe('ContaService.excluir', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    callbacksAposCommit.length = 0
  })

  it('atleta: sai dos times, anonimiza e revoga as sessões, nesta ordem', async () => {
    const { servico, ordem, tx, elenco, auditoria, eventos } = criarServico()

    await servico.excluir(ID, 'lorde2026')

    expect(ordem).toEqual([
      `membros@${LORDE}`,
      `encerrar@${LORDE}`,
      'time:t1',
      `encerrar@${LORDE}`,
      'time:t2',
      `solicitacoes@${LORDE}`,
      `vinculos@${LORDE}`,
      `auditoria@${LORDE}`,
      'anonimizar@-',
      'codigos@-',
      'preferencia@-',
      'dispositivos@-',
      'limparLogin@-',
      'tentativas@-',
      'sessoes@-',
    ])
    expect(bloquearPapeis).not.toHaveBeenCalled()
    expect(elenco.encerrarVinculo).toHaveBeenCalledWith(tx, {
      timeId: 't1',
      usuarioId: ID,
      motivo: 'EXCLUSAO_CONTA',
      executorId: ID,
    })
    expect(tx.usuario.update).toHaveBeenCalledWith({
      where: { id: ID },
      data: expect.objectContaining({
        nome: NOME_ANONIMO,
        email: emailAnonimo(ID),
        senhaHash: SENHA_HASH_INVALIDO,
        fotoKey: null,
        emailVerificado: false,
        ativo: false,
        excluidoEm: expect.any(Date) as Date,
      }) as object,
    })
    expect(auditoria.registrar).toHaveBeenCalledWith(tx, {
      entidade: 'Usuario',
      acao: 'CONTA_EXCLUIDA',
      entidadeId: ID,
      dados: { antes: { papel: Papel.ATLETA }, depois: null, contexto: { timeIds: ['t1', 't2'] } },
    })
    expect(eventos.emitirAposCommit).toHaveBeenCalledWith('usuario.sessaoEncerrada', {
      usuarioId: ID,
      sessaoIds: ['s1', 's2'],
      motivo: 'CONTA_EXCLUIDA',
      autorId: ID,
    })
  })

  it('administrador: lock e RN08 em cada atlética antes de qualquer alteração', async () => {
    const { servico, ordem } = criarServico({
      vinculos: [
        { atleticaId: LORDE, papel: Papel.ADMINISTRADOR, ativo: true },
        { atleticaId: OUTRA, papel: Papel.ADMINISTRADOR, ativo: true },
      ],
      timesPorAtletica: {},
    })

    await servico.excluir(ID, 'lorde2026')

    expect(ordem.slice(0, 5)).toEqual([
      `lock@${LORDE}`,
      `rn08@${LORDE}`,
      `lock@${OUTRA}`,
      `rn08@${OUTRA}`,
      `membros@${LORDE}`,
    ])
  })

  it('vínculo de administrador desativado não trava nem checa RN08', async () => {
    const { servico } = criarServico({
      vinculos: [{ atleticaId: LORDE, papel: Papel.ADMINISTRADOR, ativo: false }],
    })
    await servico.excluir(ID, 'lorde2026')
    expect(bloquearPapeis).not.toHaveBeenCalled()
  })

  it('último administrador: 409 sem nenhuma alteração', async () => {
    const { servico, ordem, eventos } = criarServico({
      vinculos: [{ atleticaId: LORDE, papel: Papel.ADMINISTRADOR, ativo: true }],
    })
    jest.mocked(garantirNaoUltimoAdministrador).mockRejectedValue(erroUltimoAdministrador())

    expect(await codigo(servico.excluir(ID, 'lorde2026'))).toBe('ULTIMO_ADMINISTRADOR')
    expect(ordem).toEqual([`lock@${LORDE}`])
    expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
    expect(callbacksAposCommit).toHaveLength(0)
  })

  it('senha errada → SENHA_INCORRETA, registra a falha e não abre transação', async () => {
    const { servico, limites, transacao } = criarServico({ senhaConfere: false })
    expect(await codigo(servico.excluir(ID, 'errada'))).toBe('SENHA_INCORRETA')
    expect(limites.registrar).toHaveBeenCalledWith('SENHA_CONFIRMACAO_FALHA', ID)
    expect(transacao.executar).not.toHaveBeenCalled()
  })

  it('limite atingido → 429 antes de conferir a senha', async () => {
    const { servico, limites, transacao } = criarServico()
    limites.verificar.mockRejectedValue(new ErroLimiteExcedido(60))
    expect(await codigo(servico.excluir(ID, 'lorde2026'))).toBe('RATE_LIMITED')
    expect(transacao.executar).not.toHaveBeenCalled()
  })

  it('apaga as tentativas ligadas ao e-mail original', async () => {
    const { servico, tx, limites } = criarServico()
    await servico.excluir(ID, 'lorde2026')
    expect(limites.limparPorPrefixo).toHaveBeenCalledWith('LOGIN_FALHA', 'ana@ex.com|', tx)
    expect(tx.tentativaAcesso.deleteMany).toHaveBeenCalledWith({
      where: { tipo: 'RECUPERACAO_ENVIO', chave: 'ana@ex.com' },
    })
  })

  it('a foto sai do R2 só depois do commit', async () => {
    const { servico, uploads } = criarServico()
    await servico.excluir(ID, 'lorde2026')
    expect(uploads.remover).not.toHaveBeenCalled()
    await Promise.all(callbacksAposCommit.map((callback) => callback()))
    expect(uploads.remover).toHaveBeenCalledWith(FOTO)
  })
})
