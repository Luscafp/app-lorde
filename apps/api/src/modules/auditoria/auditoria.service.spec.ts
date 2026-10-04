import { Logger } from '@nestjs/common'
import type { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { ErroAtleticaContextoAusente } from '../../infra/contexto/erros'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import {
  AuditoriaService,
  ErroAuditoria,
  TAMANHO_MAXIMO_DADOS,
  type EntradaAuditoria,
} from './auditoria.service'

const ATLETICA = '11111111-1111-4111-8111-111111111111'
const USUARIO = '22222222-2222-4222-8222-222222222222'
const EVENTO = '33333333-3333-4333-8333-333333333333'

function criar(contexto: { atleticaId?: string; usuarioId?: string; requestId?: string }) {
  const createMany = jest.fn().mockResolvedValue({ count: 0 })
  const tx = { registroAuditoria: { createMany } } as unknown as TransacaoComEscopo
  const servico = new AuditoriaService({
    atleticaId: () => contexto.atleticaId,
    usuarioId: () => contexto.usuarioId,
    requestId: () => contexto.requestId,
  } as ContextoAtletica)
  return { servico, tx, createMany }
}

/** Registros enviados na chamada `chamada` de `createMany`. */
function gravados(createMany: jest.Mock, chamada = 0): Prisma.RegistroAuditoriaCreateManyInput[] {
  const [args] = createMany.mock.calls[chamada] as [
    { data: Prisma.RegistroAuditoriaCreateManyInput[] },
  ]
  return args.data
}

function entrada(extra: Partial<EntradaAuditoria> = {}): EntradaAuditoria {
  return {
    acao: 'EVENTO_ALTERADO',
    entidade: 'Evento',
    entidadeId: EVENTO,
    dados: { antes: { local: 'A' }, depois: { local: 'B' } },
    ...extra,
  } as EntradaAuditoria
}

describe('AuditoriaService', () => {
  it('grava ator, atlética e requestId do contexto', async () => {
    const { servico, tx, createMany } = criar({
      atleticaId: ATLETICA,
      usuarioId: USUARIO,
      requestId: 'req-1',
    })
    await servico.registrar(tx, entrada())
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          atleticaId: ATLETICA,
          usuarioId: USUARIO,
          acao: 'EVENTO_ALTERADO',
          entidade: 'Evento',
          entidadeId: EVENTO,
          dados: { antes: { local: 'A' }, depois: { local: 'B' } },
          requestId: 'req-1',
        },
      ],
    })
  })

  it('serializa datas em ISO', async () => {
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
    const inicio = new Date('2026-10-01T22:00:00.000Z')
    await servico.registrar(tx, entrada({ dados: { antes: null, depois: { inicio } } }))
    expect(gravados(createMany)[0]?.dados).toEqual({
      antes: null,
      depois: { inicio: '2026-10-01T22:00:00.000Z' },
    })
  })

  it('sem ator no contexto e sem usuarioId: null → erro de programação', async () => {
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA })
    await expect(servico.registrar(tx, entrada())).rejects.toThrow(ErroAuditoria)
    expect(createMany).not.toHaveBeenCalled()
  })

  it('usuarioId: null grava ação do sistema', async () => {
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA })
    await servico.registrar(tx, entrada({ usuarioId: null }))
    expect(gravados(createMany)[0]).toMatchObject({ usuarioId: null, requestId: null })
  })

  it('sem atlética no contexto → ErroAtleticaContextoAusente', async () => {
    const { servico, tx } = criar({ usuarioId: USUARIO })
    await expect(servico.registrar(tx, entrada())).rejects.toThrow(ErroAtleticaContextoAusente)
  })

  it('dados acima de 16 KB → erro de programação', async () => {
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
    const conteudo = 'x'.repeat(TAMANHO_MAXIMO_DADOS)
    await expect(
      servico.registrar(tx, entrada({ dados: { antes: null, depois: { conteudo } } })),
    ).rejects.toThrow(ErroAuditoria)
    expect(createMany).not.toHaveBeenCalled()
  })

  it('remove campos proibidos e loga warn só com os caminhos', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation()
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
    await servico.registrar(
      tx,
      entrada({
        dados: { antes: { email: 'a@b.c', local: 'A' }, depois: { senhaHash: 'h', local: 'B' } },
      }),
    )
    expect(gravados(createMany)[0]?.dados).toEqual({
      antes: { local: 'A' },
      depois: { local: 'B' },
    })
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ removidos: ['antes.email', 'depois.senhaHash'] }),
      expect.any(String),
    )
    expect(JSON.stringify(warn.mock.calls)).not.toContain('a@b.c')
    warn.mockRestore()
  })

  it('nome é permitido só em entidades de domínio (Time, Modalidade, Atletica)', async () => {
    const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
    const dados = { antes: { nome: 'A' }, depois: { nome: 'B' } }
    await servico.registrar(tx, {
      acao: 'TIME_ALTERADO',
      entidade: 'Time',
      entidadeId: EVENTO,
      dados,
    })
    await servico.registrar(tx, {
      acao: 'CARGO_ALTERADO',
      entidade: 'VinculoAtletica',
      entidadeId: EVENTO,
      dados,
    })
    expect(gravados(createMany)[0]?.dados).toEqual(dados)
    expect(gravados(createMany, 1)[0]?.dados).toEqual({ antes: {}, depois: {} })
  })

  describe('registrarVarios', () => {
    it('0 entradas não grava', async () => {
      const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
      await servico.registrarVarios(tx, [])
      expect(createMany).not.toHaveBeenCalled()
    })

    it('valida todas as entradas antes de gravar', async () => {
      const { servico, tx, createMany } = criar({ atleticaId: ATLETICA })
      await expect(
        servico.registrarVarios(tx, [entrada({ usuarioId: null }), entrada()]),
      ).rejects.toThrow(ErroAuditoria)
      expect(createMany).not.toHaveBeenCalled()
    })

    it('divide em lotes de 500', async () => {
      const { servico, tx, createMany } = criar({ atleticaId: ATLETICA, usuarioId: USUARIO })
      await servico.registrarVarios(
        tx,
        Array.from({ length: 1001 }, () => entrada()),
      )
      expect(createMany.mock.calls.map((_, i) => gravados(createMany, i).length)).toEqual([
        500, 500, 1,
      ])
    })
  })
})

// Critério 11: combinações fora do catálogo não compilam. Só verificado pelo `pnpm typecheck`.
export function catalogoTipado(servico: AuditoriaService, tx: TransacaoComEscopo): void {
  const dados = { antes: null, depois: {} }
  // @ts-expect-error ação fora do catálogo
  void servico.registrar(tx, { acao: 'CRIAR', entidade: 'Evento', entidadeId: EVENTO, dados })
  // @ts-expect-error entidade fora do catálogo
  void servico.registrar(tx, { acao: 'TAG_CRIADA', entidade: 'Tag', entidadeId: EVENTO, dados })
  // @ts-expect-error ação de outra entidade
  void servico.registrar(tx, { acao: 'TIME_CRIADO', entidade: 'Evento', entidadeId: EVENTO, dados })
}
