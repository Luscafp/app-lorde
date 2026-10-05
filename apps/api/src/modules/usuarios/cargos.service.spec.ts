import { Papel } from '@atletica/shared'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import type { TransacaoService } from '../../infra/eventos/apos-commit'
import type { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { AuditoriaService } from '../auditoria/auditoria.service'
import { CargosService } from './cargos.service'
import { erroUltimoAdministrador } from './erros'
import {
  bloquearPapeis,
  bloquearVinculo,
  garantirNaoUltimoAdministrador,
  papelDoSolicitante,
  type VinculoBloqueado,
} from './regras-papel'

jest.mock('./regras-papel')

const ATLETICA = 'a0000000-0000-4000-8000-000000000000'
const ADMIN = {
  id: 'ad000000-0000-4000-8000-000000000000',
  papel: Papel.ADMINISTRADOR,
  atleticaId: ATLETICA,
}
const ALVO = 'b2000000-0000-4000-8000-000000000000'
const ANA = {
  id: 'v-ana',
  usuarioId: 'a1000000-0000-4000-8000-000000000000',
  usuario: { nome: 'Ana Souza' },
}

const vinculo = (dados: Partial<VinculoBloqueado> = {}): VinculoBloqueado => ({
  id: 'v-alvo',
  papel: Papel.ATLETA,
  ativo: true,
  excluido: false,
  ...dados,
})

function criarServico({ alvo = vinculo(), ocupante = null as typeof ANA | null } = {}) {
  const ordem: string[] = []
  const tx = {
    vinculoAtletica: {
      findFirst: jest.fn().mockResolvedValue(ocupante),
      update: jest.fn(({ where }: { where: { id: string } }) => {
        ordem.push(where.id)
        return Promise.resolve()
      }),
    },
  }
  jest.mocked(bloquearPapeis).mockResolvedValue()
  jest.mocked(bloquearVinculo).mockResolvedValue(alvo)
  jest.mocked(papelDoSolicitante).mockResolvedValue(Papel.ADMINISTRADOR)
  jest.mocked(garantirNaoUltimoAdministrador).mockResolvedValue()
  const transacao = { executar: jest.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)) }
  const auditoria = { registrarVarios: jest.fn() }
  const eventos = { emitirAposCommit: jest.fn() }
  const servico = new CargosService(
    transacao as unknown as TransacaoService,
    auditoria as unknown as AuditoriaService,
    eventos as unknown as EventosDominioService,
  )
  const alterar = (papel: Papel, confirmarSubstituicao?: boolean) =>
    servico.alterarPapel(ALVO, { papel, confirmarSubstituicao }, ADMIN)
  return { alterar, tx, transacao, auditoria, eventos, ordem }
}

async function codigo(promessa: Promise<unknown>): Promise<string> {
  const erro: unknown = await promessa.catch((e: unknown) => e)
  if (erro instanceof ErroNegocio) return erro.code
  throw new Error(`esperava ErroNegocio, recebeu ${String(erro)}`)
}

describe('CargosService.alterarPapel', () => {
  beforeEach(() => jest.clearAllMocks())

  it('promove, audita e emite o evento com o autor', async () => {
    const { alterar, tx, auditoria, eventos } = criarServico()

    const resposta = await alterar(Papel.DIRETOR)

    expect(resposta).toEqual({
      alterado: true,
      usuario: { id: ALVO, papelAnterior: 'ATLETA', papel: 'DIRETOR' },
      substituido: null,
    })
    expect(bloquearPapeis).toHaveBeenCalledWith(tx, ATLETICA)
    expect(papelDoSolicitante).toHaveBeenCalledWith(tx, ADMIN.id, Papel.ADMINISTRADOR)
    expect(tx.vinculoAtletica.update).toHaveBeenCalledWith({
      where: { id: 'v-alvo' },
      data: { papel: 'DIRETOR' },
    })
    expect(auditoria.registrarVarios).toHaveBeenCalledWith(tx, [
      {
        entidade: 'VinculoAtletica',
        acao: 'CARGO_ALTERADO',
        entidadeId: ALVO,
        dados: { antes: { papel: 'ATLETA' }, depois: { papel: 'DIRETOR' } },
      },
    ])
    expect(eventos.emitirAposCommit).toHaveBeenCalledWith('usuario.papelAlterado', {
      atleticaId: ATLETICA,
      usuarioId: ALVO,
      papelAnterior: 'ATLETA',
      papelNovo: 'DIRETOR',
      autorId: ADMIN.id,
    })
  })

  it('mesmo papel: alterado false, sem escrita, auditoria nem evento', async () => {
    const { alterar, tx, auditoria, eventos } = criarServico({
      alvo: vinculo({ papel: Papel.DIRETOR }),
    })

    expect(await alterar(Papel.DIRETOR)).toEqual({
      alterado: false,
      usuario: { id: ALVO, papelAnterior: 'DIRETOR', papel: 'DIRETOR' },
      substituido: null,
    })
    expect(tx.vinculoAtletica.update).not.toHaveBeenCalled()
    expect(auditoria.registrarVarios).not.toHaveBeenCalled()
    expect(eventos.emitirAposCommit).not.toHaveBeenCalled()
  })

  it('sem vínculo na atlética → NOT_FOUND', async () => {
    const { alterar } = criarServico()
    jest.mocked(bloquearVinculo).mockResolvedValue(undefined)
    expect(await codigo(alterar(Papel.DIRETOR))).toBe('NOT_FOUND')
  })

  it('conta excluída → USUARIO_EXCLUIDO, mesmo repetindo o papel', async () => {
    const { alterar } = criarServico({ alvo: vinculo({ excluido: true }) })
    expect(await codigo(alterar(Papel.ATLETA))).toBe('USUARIO_EXCLUIDO')
  })

  describe('substituição de Presidente/Vice (RN07)', () => {
    it.each([Papel.PRESIDENTE, Papel.VICE_PRESIDENTE])(
      '%s ocupado sem confirmação → SUBSTITUICAO_NECESSARIA, nada muda',
      async (papel) => {
        const { alterar, tx } = criarServico({ ocupante: ANA })

        const erro = (await alterar(papel).catch((e: unknown) => e)) as ErroNegocio

        expect(erro.code).toBe('SUBSTITUICAO_NECESSARIA')
        expect(erro.message).toMatch(/^Ana Souza é o\(a\) atual .+ e passará a Diretor\(a\)\.$/)
        expect(tx.vinculoAtletica.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({ where: { papel, usuarioId: { not: ALVO } } }),
        )
        expect(tx.vinculoAtletica.update).not.toHaveBeenCalled()
      },
    )

    it('confirmada: o ocupante vira Diretor antes do alvo, com auditoria e evento para ambos', async () => {
      const { alterar, auditoria, eventos, ordem } = criarServico({
        alvo: vinculo({ papel: Papel.VICE_PRESIDENTE }),
        ocupante: ANA,
      })

      const resposta = await alterar(Papel.PRESIDENTE, true)

      expect(resposta.substituido).toEqual({
        id: ANA.usuarioId,
        nome: 'Ana Souza',
        papelAnterior: 'PRESIDENTE',
        papel: 'DIRETOR',
      })
      expect(ordem).toEqual(['v-ana', 'v-alvo'])
      const [, entradas] = auditoria.registrarVarios.mock.calls[0] as [unknown, unknown[]]
      expect(entradas).toEqual([
        expect.objectContaining({
          entidadeId: ANA.usuarioId,
          dados: {
            antes: { papel: 'PRESIDENTE' },
            depois: { papel: 'DIRETOR' },
            contexto: { substituidoPor: ALVO },
          },
        }),
        expect.objectContaining({
          entidadeId: ALVO,
          dados: { antes: { papel: 'VICE_PRESIDENTE' }, depois: { papel: 'PRESIDENTE' } },
        }),
      ])
      expect(eventos.emitirAposCommit.mock.calls.map(([, payload]: unknown[]) => payload)).toEqual([
        expect.objectContaining({ usuarioId: ANA.usuarioId, papelNovo: 'DIRETOR' }),
        expect.objectContaining({ usuarioId: ALVO, papelNovo: 'PRESIDENTE' }),
      ])
    })

    it('cargo vago: promove direto, sem confirmação (UC24 A2)', async () => {
      const { alterar } = criarServico()
      expect((await alterar(Papel.VICE_PRESIDENTE)).substituido).toBeNull()
    })

    it('Diretor não consulta ocupante', async () => {
      const { alterar, tx } = criarServico()
      await alterar(Papel.DIRETOR)
      expect(tx.vinculoAtletica.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('último Administrador (RN08)', () => {
    it('Administrador perdendo o cargo consulta o helper da #27', async () => {
      const { alterar, tx } = criarServico({ alvo: vinculo({ papel: Papel.ADMINISTRADOR }) })
      await alterar(Papel.DIRETOR)
      expect(garantirNaoUltimoAdministrador).toHaveBeenCalledWith(tx, ATLETICA, ALVO)
    })

    it('helper recusa → ULTIMO_ADMINISTRADOR, nada muda', async () => {
      const { alterar, tx } = criarServico({ alvo: vinculo({ papel: Papel.ADMINISTRADOR }) })
      jest.mocked(garantirNaoUltimoAdministrador).mockRejectedValue(erroUltimoAdministrador())
      expect(await codigo(alterar(Papel.PRESIDENTE))).toBe('ULTIMO_ADMINISTRADOR')
      expect(tx.vinculoAtletica.update).not.toHaveBeenCalled()
    })

    it('alvo que não é Administrador não consulta o helper', async () => {
      const { alterar } = criarServico({ alvo: vinculo({ papel: Papel.DIRETOR }) })
      await alterar(Papel.ADMINISTRADOR)
      expect(garantirNaoUltimoAdministrador).not.toHaveBeenCalled()
    })
  })

  describe('usuário desativado', () => {
    it.each([Papel.DIRETOR, Papel.PRESIDENTE, Papel.ADMINISTRADOR])(
      'promover a %s → USUARIO_DESATIVADO',
      async (papel) => {
        const { alterar } = criarServico({ alvo: vinculo({ ativo: false }) })
        expect(await codigo(alterar(papel))).toBe('USUARIO_DESATIVADO')
      },
    )

    it('rebaixar a Atleta é permitido', async () => {
      const { alterar } = criarServico({ alvo: vinculo({ papel: Papel.DIRETOR, ativo: false }) })
      expect((await alterar(Papel.ATLETA)).alterado).toBe(true)
    })
  })

  it('P2002 do índice único → CONFLITO_CONCORRENTE', async () => {
    const { alterar, tx } = criarServico()
    tx.vinculoAtletica.update.mockRejectedValue(
      new PrismaClientKnownRequestError('único', { code: 'P2002', clientVersion: '7' }),
    )
    expect(await codigo(alterar(Papel.PRESIDENTE))).toBe('CONFLITO_CONCORRENTE')
  })

  it('outros erros do Prisma seguem adiante', async () => {
    const { alterar, tx } = criarServico()
    const falha = new PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: '7' })
    tx.vinculoAtletica.update.mockRejectedValue(falha)
    await expect(alterar(Papel.DIRETOR)).rejects.toBe(falha)
  })
})
