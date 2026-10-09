import {
  alteracoesDaAuditoria,
  periodoAuditoria,
  type AutorAuditoria,
  type EntidadeAuditoria,
  type ListaAuditoria,
  type ListarAuditoriaQuery,
  type RegistroAuditoriaDetalhe,
  type RegistroAuditoriaResumo,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { NOME_DE_DOMINIO } from './auditoria.service'
import { erroRegistroNaoEncontrado } from './erros'
import { idsCitados, nomeDe, ReferenciasAuditoria } from './referencias'
import { sanitizar } from './sanitizar'

const SELECAO = {
  id: true,
  acao: true,
  entidade: true,
  entidadeId: true,
  criadoEm: true,
  dados: true,
  usuario: { select: { id: true, nome: true, excluidoEm: true } },
} as const satisfies Prisma.RegistroAuditoriaSelect

type Linha = Prisma.RegistroAuditoriaGetPayload<{ select: typeof SELECAO }>

function autorDe(usuario: Linha['usuario']): AutorAuditoria {
  if (!usuario) return null
  return { id: usuario.id, nome: nomeDe(usuario), anonimizado: usuario.excluidoEm !== null }
}

function dadosSanitizados(linha: Linha): unknown {
  const nomeDeDominio = NOME_DE_DOMINIO.has(linha.entidade as EntidadeAuditoria)
  return sanitizar(linha.dados, nomeDeDominio).valor
}

function resumo(linha: Linha, dados: unknown): RegistroAuditoriaResumo {
  return {
    id: linha.id,
    acao: linha.acao,
    entidade: linha.entidade,
    entidadeId: linha.entidadeId,
    autor: autorDe(linha.usuario),
    criadoEm: linha.criadoEm.toISOString(),
    resumo: { campos: alteracoesDaAuditoria(dados)?.alteracoes.map(({ campo }) => campo) ?? [] },
  }
}

/** Consulta somente leitura do histórico (RF43, issue #39); não gera auditoria. */
@Injectable()
export class AuditoriaConsultaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly referencias: ReferenciasAuditoria,
  ) {}

  async listar(query: ListarAuditoriaQuery, agora = Date.now()): Promise<ListaAuditoria> {
    const { page, limit, entidade, entidadeId, usuarioId, acao } = query
    const { de, ate } = periodoAuditoria(query, agora)
    const where: Prisma.RegistroAuditoriaWhereInput = {
      criadoEm: { gte: de, lte: ate },
      ...(entidade && { entidade }),
      ...(entidadeId && { entidadeId }),
      ...(usuarioId && { usuarioId }),
      ...(acao && { acao }),
    }

    const [linhas, total] = await Promise.all([
      this.prisma.db.registroAuditoria.findMany({
        where,
        select: SELECAO,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.db.registroAuditoria.count({ where }),
    ])
    const items = linhas.map((linha) => resumo(linha, dadosSanitizados(linha)))
    return { items, page, limit, total }
  }

  /** De outra atlética: a extensão multi-atlética não encontra → 404. */
  async detalhar(id: string): Promise<RegistroAuditoriaDetalhe> {
    const linha = await this.prisma.db.registroAuditoria.findFirst({
      where: { id },
      select: SELECAO,
    })
    if (!linha) throw erroRegistroNaoEncontrado()

    const dados = dadosSanitizados(linha)
    const referencias = await this.referencias.resolver(
      idsCitados(dados, new Set([linha.entidadeId])),
    )
    const rotuloRegistro =
      referencias.registros[linha.entidadeId] ?? referencias.usuarios[linha.entidadeId] ?? null
    return { ...resumo(linha, dados), rotuloRegistro, dados, referencias }
  }
}
