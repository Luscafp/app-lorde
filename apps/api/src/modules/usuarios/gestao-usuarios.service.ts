import {
  ehPresidencia,
  Papel,
  podeAgirSobre,
  SituacaoUsuario,
  type ListarUsuariosQuery,
  type ListaUsuarios,
  type SituacaoAlterada,
  type SituacaoFiltro,
  type UsuarioDetalhe,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { Prisma } from '../../generated/prisma/client'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { erroSemPermissao } from '../auth/erros'
import { SessaoService } from '../auth/sessao.service'
import type { UsuarioAutenticado } from '../auth/tipos'
import { UploadsService } from '../uploads/uploads.service'
import {
  erroAlvoProprio,
  erroNivelInsuficiente,
  erroUsuarioExcluido,
  erroUsuarioNaoEncontrado,
} from './erros'
import { bloquearPapeis, calcularPermissoes, ehUltimoAdministrador } from './regras-papel'

type Solicitante = Pick<UsuarioAutenticado, 'id' | 'papel' | 'atleticaId'>

interface LinhaUsuario {
  id: string
  nome: string
  email: string
  fotoKey: string | null
  papel: Papel
  ativo: boolean
}

interface VinculoBloqueado {
  id: string
  papel: Papel
  ativo: boolean
  excluido: boolean
}

function situacaoDe(ativo: boolean): SituacaoFiltro {
  return ativo ? SituacaoUsuario.ATIVO : SituacaoUsuario.DESATIVADO
}

/** `%`, `_` e `\` do termo viram literais no `LIKE`. */
function padraoLike(termo: string): string {
  return `%${termo.replace(/[\\%_]/g, (caractere) => `\\${caractere}`)}%`
}

function filtrosDaLista(atleticaId: string, query: ListarUsuariosQuery): Prisma.Sql {
  const condicoes = [
    Prisma.sql`v."atleticaId" = ${atleticaId}::uuid`,
    Prisma.sql`u."excluidoEm" IS NULL`,
  ]
  if (query.papel) condicoes.push(Prisma.sql`v."papel" = ${query.papel}::"Papel"`)
  if (query.situacao) {
    condicoes.push(Prisma.sql`v."ativo" = ${query.situacao === SituacaoUsuario.ATIVO}`)
  }
  if (query.busca) {
    const padrao = padraoLike(query.busca)
    condicoes.push(
      Prisma.sql`(unaccent(lower(u."nome")) LIKE unaccent(lower(${padrao})) ESCAPE '\\'
        OR u."email" LIKE lower(${padrao}) ESCAPE '\\')`,
    )
  }
  return Prisma.join(condicoes, ' AND ')
}

/** Painel de Usuários da Presidência (UC23, issue #27). */
@Injectable()
export class GestaoUsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly sessoes: SessaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
    private readonly uploads: UploadsService,
  ) {}

  /** `$queryRaw` não passa pela extensão multi-atlética: o `atleticaId` vai no SQL. */
  async listar(atleticaId: string, query: ListarUsuariosQuery): Promise<ListaUsuarios> {
    const { page, limit } = query
    const filtros = filtrosDaLista(atleticaId, query)
    const origem = Prisma.sql`FROM "VinculoAtletica" v JOIN "Usuario" u ON u."id" = v."usuarioId"`

    const [linhas, [contagem]] = await Promise.all([
      this.prisma.db.$queryRaw<LinhaUsuario[]>`
        SELECT u."id", u."nome", u."email", u."fotoKey", v."papel", v."ativo"
        ${origem} WHERE ${filtros}
        ORDER BY unaccent(lower(u."nome")), u."id"
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      this.prisma.db.$queryRaw<[{ total: bigint }]>`
        SELECT count(*) AS "total" ${origem} WHERE ${filtros}`,
    ])

    return {
      items: linhas.map(({ fotoKey, ativo, ...usuario }) => ({
        ...usuario,
        fotoUrl: this.uploads.urlPublica(fotoKey),
        situacao: situacaoDe(ativo),
      })),
      page,
      limit,
      total: Number(contagem?.total ?? 0),
    }
  }

  async detalhar(id: string, solicitante: Solicitante): Promise<UsuarioDetalhe> {
    const { atleticaId } = solicitante
    const vinculo = await this.prisma.db.vinculoAtletica.findFirst({
      where: { usuarioId: id },
      select: {
        papel: true,
        ativo: true,
        usuario: {
          select: {
            nome: true,
            email: true,
            fotoKey: true,
            criadoEm: true,
            excluidoEm: true,
            membrosTime: {
              where: { atleticaId, saidaEm: null },
              orderBy: { time: { nome: 'asc' } },
              select: {
                time: {
                  select: {
                    id: true,
                    nome: true,
                    capitaoId: true,
                    modalidade: { select: { id: true, nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!vinculo) throw erroUsuarioNaoEncontrado()

    const { usuario, papel, ativo } = vinculo
    const excluido = usuario.excluidoEm !== null
    const ehUltimoAdmin =
      papel === Papel.ADMINISTRADOR &&
      ativo &&
      !excluido &&
      (await ehUltimoAdministrador(this.prisma.db, atleticaId, id))

    return {
      id,
      nome: usuario.nome,
      email: usuario.email,
      fotoUrl: excluido ? null : this.uploads.urlPublica(usuario.fotoKey),
      papel,
      situacao: excluido ? SituacaoUsuario.EXCLUIDO : situacaoDe(ativo),
      criadoEm: usuario.criadoEm.toISOString(),
      times: excluido
        ? []
        : usuario.membrosTime.map(({ time: { capitaoId, ...time } }) => ({
            ...time,
            capitao: capitaoId === id,
          })),
      estatisticas: null,
      permissoes: calcularPermissoes(solicitante, { id, papel, excluido }, ehUltimoAdmin),
    }
  }

  /** Lock de papéis + lock da linha do alvo: consistente com a troca de cargo concorrente (#28). */
  async alterarSituacao(
    id: string,
    ativo: boolean,
    solicitante: Solicitante,
  ): Promise<SituacaoAlterada> {
    const { atleticaId } = solicitante
    return this.transacao.executar(async (tx) => {
      await bloquearPapeis(tx, atleticaId)
      const alvo = await this.bloquearVinculo(tx, id, atleticaId)
      if (!alvo) throw erroUsuarioNaoEncontrado()
      if (alvo.excluido) throw erroUsuarioExcluido()
      if (id === solicitante.id) throw erroAlvoProprio()
      await this.conferirNivel(tx, solicitante.id, alvo.papel)

      const resposta = { id, situacao: situacaoDe(ativo) }
      if (alvo.ativo === ativo) return resposta

      await tx.vinculoAtletica.update({ where: { id: alvo.id }, data: { ativo } })
      if (!ativo) await this.revogarSessoes(tx, id, solicitante)
      await this.auditoria.registrar(tx, {
        entidade: 'VinculoAtletica',
        acao: ativo ? 'USUARIO_REATIVADO' : 'USUARIO_DESATIVADO',
        entidadeId: id,
        dados: { antes: { ativo: alvo.ativo }, depois: { ativo } },
      })
      return resposta
    })
  }

  private async bloquearVinculo(
    tx: TransacaoComEscopo,
    usuarioId: string,
    atleticaId: string,
  ): Promise<VinculoBloqueado | undefined> {
    const [vinculo] = await tx.$queryRaw<VinculoBloqueado[]>`
      SELECT v."id", v."papel", v."ativo", u."excluidoEm" IS NOT NULL AS "excluido"
      FROM "VinculoAtletica" v JOIN "Usuario" u ON u."id" = v."usuarioId"
      WHERE v."usuarioId" = ${usuarioId}::uuid AND v."atleticaId" = ${atleticaId}::uuid
      FOR UPDATE OF v`
    return vinculo
  }

  /** O papel do solicitante é relido sob o lock: pode ter mudado desde o guard. */
  private async conferirNivel(
    tx: TransacaoComEscopo,
    solicitanteId: string,
    papelAlvo: Papel,
  ): Promise<void> {
    const ator = await tx.vinculoAtletica.findFirst({
      where: { usuarioId: solicitanteId, ativo: true },
      select: { papel: true },
    })
    if (!ator || !ehPresidencia(ator.papel)) throw erroSemPermissao()
    if (!podeAgirSobre(ator.papel, papelAlvo)) throw erroNivelInsuficiente()
  }

  private async revogarSessoes(
    tx: TransacaoComEscopo,
    usuarioId: string,
    { id: autorId, atleticaId }: Solicitante,
  ): Promise<void> {
    const sessaoIds = await this.sessoes.revogarTodas(tx, usuarioId, 'CONTA_DESATIVADA', {
      atleticaId,
    })
    if (sessaoIds.length === 0) return
    this.eventos.emitirAposCommit('usuario.sessaoEncerrada', {
      atleticaId,
      usuarioId,
      sessaoIds,
      motivo: 'CONTA_DESATIVADA',
      autorId,
    })
  }
}
