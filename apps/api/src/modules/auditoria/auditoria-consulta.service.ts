import {
  periodoAuditoria,
  ROTULO_AUTOR_EXCLUIDO,
  type AutorAuditoria,
  type EntidadeAuditoria,
  type ListaAuditoria,
  type ListarAuditoriaQuery,
  type RegistroAuditoriaDetalhe,
  type RegistroAuditoriaResumo,
} from '@atletica/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import { PrismaService } from '../../infra/prisma/prisma.service'
import type { Prisma } from '../../generated/prisma/client'
import { NOME_DE_DOMINIO } from './auditoria.service'
import { idsCitados, ReferenciasAuditoria } from './referencias'
import { sanitizar } from './sanitizar'

const SELECAO = {
  id: true,
  acao: true,
  entidade: true,
  entidadeId: true,
  criadoEm: true,
  usuario: { select: { id: true, nome: true, excluidoEm: true } },
} as const satisfies Prisma.RegistroAuditoriaSelect

type Linha = Prisma.RegistroAuditoriaGetPayload<{ select: typeof SELECAO }>

function autorDe(usuario: Linha['usuario']): AutorAuditoria {
  if (!usuario) return null
  const anonimizado = usuario.excluidoEm !== null
  return {
    id: usuario.id,
    nome: anonimizado ? ROTULO_AUTOR_EXCLUIDO : usuario.nome,
    anonimizado,
  }
}

function resumo(linha: Linha, referencias: Record<string, string>): RegistroAuditoriaResumo {
  return {
    id: linha.id,
    acao: linha.acao,
    entidade: linha.entidade,
    entidadeId: linha.entidadeId,
    rotuloRegistro: referencias[linha.entidadeId] ?? null,
    autor: autorDe(linha.usuario),
    criadoEm: linha.criadoEm.toISOString(),
  }
}

export function erroRegistroNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Registro de auditoria não encontrado.')
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
    const referencias = await this.referencias.resolver(linhas.map((l) => l.entidadeId))

    return { items: linhas.map((linha) => resumo(linha, referencias)), page, limit, total }
  }

  /** De outra atlética: a extensão multi-atlética não encontra → 404. */
  async detalhar(id: string): Promise<RegistroAuditoriaDetalhe> {
    const linha = await this.prisma.db.registroAuditoria.findFirst({
      where: { id },
      select: { ...SELECAO, dados: true },
    })
    if (!linha) throw erroRegistroNaoEncontrado()

    const nomeDeDominio = NOME_DE_DOMINIO.has(linha.entidade as EntidadeAuditoria)
    const { valor: dados } = sanitizar(linha.dados, nomeDeDominio)
    const referencias = await this.referencias.resolver(
      idsCitados(dados, new Set([linha.entidadeId])),
    )
    return { ...resumo(linha, referencias), dados, referencias }
  }
}
