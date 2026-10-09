import { listarAuditoriaQuerySchema, type ListarAuditoriaQuery } from '@atletica/shared'
import { codigoDaRejeicao } from '../../../test/suporte/codigo-do-erro'
import type { PrismaService } from '../../infra/prisma/prisma.service'
import { AuditoriaConsultaService } from './auditoria-consulta.service'
import type { ReferenciasAuditoria } from './referencias'

const ID = '0b6f8a52-8e5d-4a43-9d6c-1f0f3c2b7a90'
const EVENTO = '3e7d9c1b-5a4f-4e2d-8b6a-9c0d1e2f3a4b'
const AUTOR = '7c2e4b9a-1d3f-4a5b-8c6d-0e1f2a3b4c5d'
const AGORA = Date.parse('2026-10-08T12:00:00.000Z')

function linha(parcial: Record<string, unknown> = {}) {
  return {
    id: ID,
    acao: 'RESULTADO_CORRIGIDO',
    entidade: 'Evento',
    entidadeId: EVENTO,
    criadoEm: new Date('2026-10-07T23:40:00.000Z'),
    dados: {
      antes: { placarTime: 2, resultado: 'EMPATE', senhaHash: 'x' },
      depois: { placarTime: 3, resultado: 'VITORIA' },
    },
    usuario: { id: AUTOR, nome: 'Ana Souza', excluidoEm: null },
    ...parcial,
  }
}

function criarServico(linhas: ReturnType<typeof linha>[] = [linha()]) {
  const registroAuditoria = {
    findMany: jest.fn().mockResolvedValue(linhas),
    count: jest.fn().mockResolvedValue(linhas.length),
    findFirst: jest.fn().mockResolvedValue(linhas[0] ?? null),
  }
  const referencias = {
    resolver: jest.fn().mockResolvedValue({
      usuarios: { [AUTOR]: 'Ana Souza' },
      registros: { [EVENTO]: 'Jogo Futsal 07/10/2026 20:40' },
    }),
  }
  const servico = new AuditoriaConsultaService(
    { db: { registroAuditoria } } as unknown as PrismaService,
    referencias as unknown as ReferenciasAuditoria,
  )
  return { servico, registroAuditoria, referencias }
}

const query = (parcial: Record<string, unknown> = {}): ListarAuditoriaQuery =>
  listarAuditoriaQuerySchema.parse(parcial)

describe('AuditoriaConsultaService.listar', () => {
  it('sem filtros: últimos 30 dias, mais recente primeiro, página pelo offset', async () => {
    const { servico, registroAuditoria } = criarServico()
    await servico.listar(query({ page: '3', limit: '10' }), AGORA)

    expect(registroAuditoria.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          criadoEm: {
            gte: new Date('2026-09-08T12:00:00.000Z'),
            lte: new Date('2026-10-08T12:00:00.000Z'),
          },
        },
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip: 20,
        take: 10,
      }),
    )
  })

  it('cada filtro vira a coluna correspondente; `usuarioId` é o ator', async () => {
    const { servico, registroAuditoria } = criarServico()
    await servico.listar(
      query({
        entidade: 'Evento',
        entidadeId: EVENTO,
        usuarioId: AUTOR,
        acao: 'RESULTADO_CORRIGIDO',
        de: '2026-09-01',
        ate: '2026-09-15',
      }),
    )

    const where = {
      criadoEm: {
        gte: new Date('2026-09-01T03:00:00.000Z'),
        lte: new Date('2026-09-16T02:59:59.999Z'),
      },
      entidade: 'Evento',
      entidadeId: EVENTO,
      usuarioId: AUTOR,
      acao: 'RESULTADO_CORRIGIDO',
    }
    expect(registroAuditoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }))
    expect(registroAuditoria.count).toHaveBeenCalledWith({ where })
  })

  it('resumo só com os nomes dos campos, sem os bloqueados; não resolve referências', async () => {
    const { servico, referencias } = criarServico([
      linha(),
      linha({ id: EVENTO, dados: { legado: true }, usuario: null }),
    ])
    const { items, total } = await servico.listar(query(), AGORA)

    expect(total).toBe(2)
    expect(items[0]).toEqual({
      id: ID,
      acao: 'RESULTADO_CORRIGIDO',
      entidade: 'Evento',
      entidadeId: EVENTO,
      autor: { id: AUTOR, nome: 'Ana Souza', anonimizado: false },
      criadoEm: '2026-10-07T23:40:00.000Z',
      resumo: { campos: ['placarTime', 'resultado'] },
    })
    expect(items[1]).toMatchObject({ autor: null, resumo: { campos: [] } })
    expect(referencias.resolver).not.toHaveBeenCalled()
  })

  it('autor com conta excluída vem anonimizado', async () => {
    const excluido = { id: AUTOR, nome: 'Usuário excluído', excluidoEm: new Date() }
    const { servico } = criarServico([linha({ usuario: excluido })])
    const { items } = await servico.listar(query(), AGORA)
    expect(items[0]?.autor).toEqual({ id: AUTOR, nome: 'Usuário excluído', anonimizado: true })
  })
})

describe('AuditoriaConsultaService.detalhar', () => {
  it('dados sanitizados, ids citados resolvidos e rótulo do registro', async () => {
    const { servico, referencias } = criarServico([
      linha({
        dados: {
          antes: { placarTime: 2 },
          depois: { placarTime: 3, email: 'x@ex.com' },
          contexto: { usuarioId: AUTOR },
        },
      }),
    ])
    const detalhe = await servico.detalhar(ID)

    expect(detalhe.dados).toEqual({
      antes: { placarTime: 2 },
      depois: { placarTime: 3 },
      contexto: { usuarioId: AUTOR },
    })
    expect(referencias.resolver).toHaveBeenCalledWith(new Set([EVENTO, AUTOR]))
    expect(detalhe.rotuloRegistro).toBe('Jogo Futsal 07/10/2026 20:40')
    expect(detalhe.resumo.campos).toEqual(['placarTime'])
  })

  it('registro inexistente ou de outra atlética → NOT_FOUND', async () => {
    const { servico } = criarServico([])
    expect(await codigoDaRejeicao(servico.detalhar(ID))).toBe('NOT_FOUND')
  })
})
