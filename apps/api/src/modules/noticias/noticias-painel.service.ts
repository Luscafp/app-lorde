import {
  FinalidadeUpload,
  StatusNoticia,
  type ListaNoticiasPainel,
  type NoticiaAtualizacao,
  type NoticiaCriacao,
  type NoticiaPainelDetalheDto,
  type NoticiaPainelDto,
  type NoticiasPainelQuery,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { padraoLike, paginarPorSql } from '../../common/busca'
import { Prisma } from '../../generated/prisma/client'
import { aposCommit, TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { naoExcluido } from '../../infra/prisma/nao-excluido'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type DadosAuditoria } from '../auditoria/auditoria.service'
import { diferenca, type DiferencaAuditoria } from '../auditoria/diferenca'
import type { UsuarioAutenticado } from '../auth/tipos'
import { UploadsService } from '../uploads/uploads.service'
import { erroCapaObrigatoria, erroConteudoObrigatorio, erroNoticiaNaoEncontrada } from './erros'

export type Solicitante = Pick<UsuarioAutenticado, 'id' | 'atleticaId'>

const CAMPOS = {
  id: true,
  titulo: true,
  conteudo: true,
  imagemCapaKey: true,
  status: true,
  publicadaEm: true,
  criadoEm: true,
  atualizadoEm: true,
  autor: { select: { id: true, nome: true } },
} as const satisfies Prisma.NoticiaSelect

type LinhaNoticia = Prisma.NoticiaGetPayload<{ select: typeof CAMPOS }>

interface Editaveis {
  titulo: string
  conteudo: string
  imagemCapaKey: string | null
}

const EDITAVEIS = ['titulo', 'conteudo', 'imagemCapaKey'] as const

/** Requisitos de publicação (convenções §11.4 e §11.9). */
function garantirPublicavel({ conteudo, imagemCapaKey }: Editaveis): void {
  if (!imagemCapaKey) throw erroCapaObrigatoria()
  if (conteudo.trim().length === 0) throw erroConteudoObrigatorio()
}

/** `$queryRaw` não passa pela extensão multi-atlética: o filtro de atlética vai no SQL. */
function filtrosDaLista(atleticaId: string, { status, q }: NoticiasPainelQuery): Prisma.Sql {
  const condicoes = [
    Prisma.sql`n."atleticaId" = ${atleticaId}::uuid`,
    Prisma.sql`n."excluidoEm" IS NULL`,
  ]
  if (status) condicoes.push(Prisma.sql`n."status" = ${status}::"StatusNoticia"`)
  if (q) {
    condicoes.push(
      Prisma.sql`unaccent(lower(n."titulo")) LIKE unaccent(lower(${padraoLike(q)})) ESCAPE '\\'`,
    )
  }
  return Prisma.join(condicoes, ' AND ')
}

/** Sem o conteúdo nem a chave da capa (convenções §7): só o título e indicadores. */
function dadosDaAlteracao({ antes, depois }: DiferencaAuditoria): DadosAuditoria {
  const titulo = 'titulo' in depois
  return {
    antes: titulo ? { titulo: antes.titulo } : {},
    depois: {
      ...(titulo && { titulo: depois.titulo }),
      ...('conteudo' in depois && { conteudoAlterado: true }),
      ...('imagemCapaKey' in depois && { capaAlterada: true }),
    },
  }
}

/** Gestão de notícias pelo Painel (UC21, issue #80). */
@Injectable()
export class NoticiasPainelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
    private readonly uploads: UploadsService,
  ) {}

  /** Rascunhos e publicadas, da edição mais recente para a mais antiga. */
  async listar(atleticaId: string, query: NoticiasPainelQuery): Promise<ListaNoticiasPainel> {
    const origem = Prisma.sql`FROM "Noticia" n WHERE ${filtrosDaLista(atleticaId, query)}`
    const pagina = await paginarPorSql(this.prisma.db, query, {
      ids: Prisma.sql`SELECT n."id" ${origem} ORDER BY n."atualizadoEm" DESC, n."id" DESC`,
      total: Prisma.sql`SELECT count(*) AS "total" ${origem}`,
      buscar: (ids) =>
        this.prisma.db.noticia.findMany({ where: { id: { in: ids } }, select: CAMPOS }),
    })
    return { ...pagina, items: pagina.items.map((noticia) => this.paraItem(noticia)) }
  }

  async detalhar(id: string): Promise<NoticiaPainelDetalheDto> {
    const noticia = await this.prisma.db.noticia.findFirst({
      where: { id, ...naoExcluido },
      select: CAMPOS,
    })
    if (!noticia) throw erroNoticiaNaoEncontrada()
    return this.paraDto(noticia)
  }

  async criar(solicitante: Solicitante, entrada: NoticiaCriacao): Promise<NoticiaPainelDetalheDto> {
    const { publicar = false, titulo, conteudo = '', imagemCapaKey = null } = entrada
    if (publicar) garantirPublicavel({ titulo, conteudo, imagemCapaKey })
    if (imagemCapaKey) await this.validarCapa(imagemCapaKey, solicitante)

    return this.transacao.executar(async (tx) => {
      const publicadaEm = publicar ? new Date() : null
      const criada = await tx.noticia.create({
        data: {
          titulo,
          conteudo,
          imagemCapaKey,
          atleticaId: solicitante.atleticaId,
          autorId: solicitante.id,
          ...(publicadaEm && { status: StatusNoticia.PUBLICADA, publicadaEm }),
        },
        select: CAMPOS,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_CRIADA',
        entidadeId: criada.id,
        dados: { antes: null, depois: { titulo, status: StatusNoticia.RASCUNHO } },
      })
      if (publicadaEm) await this.registrarPublicacao(tx, criada.id, publicadaEm, true, solicitante)
      return this.paraDto(criada)
    })
  }

  /** Publicada continua atendendo aos requisitos; `publicadaEm` e o status não mudam (A1). */
  atualizar(
    id: string,
    solicitante: Solicitante,
    entrada: NoticiaAtualizacao,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante.atleticaId)
      const depois: Editaveis = {
        titulo: entrada.titulo ?? antes.titulo,
        conteudo: entrada.conteudo ?? antes.conteudo,
        imagemCapaKey:
          entrada.imagemCapaKey === undefined ? antes.imagemCapaKey : entrada.imagemCapaKey,
      }
      const diff = diferenca<Editaveis>(antes, depois, EDITAVEIS)
      if (!diff) return this.paraDto(antes)

      if (antes.status === StatusNoticia.PUBLICADA) garantirPublicavel(depois)
      const capaAnterior = antes.imagemCapaKey
      const trocouCapa = depois.imagemCapaKey !== capaAnterior
      if (trocouCapa && depois.imagemCapaKey) {
        await this.validarCapa(depois.imagemCapaKey, solicitante)
      }

      const atualizada = await tx.noticia.update({ where: { id }, data: depois, select: CAMPOS })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_ALTERADA',
        entidadeId: id,
        dados: dadosDaAlteracao(diff),
      })
      if (trocouCapa && capaAnterior) aposCommit(() => this.uploads.remover(capaAnterior))
      return this.paraDto(atualizada)
    })
  }

  /** Idempotente; a republicação mantém `publicadaEm` e não emite `noticia.publicada`. */
  publicar(id: string, solicitante: Solicitante): Promise<NoticiaPainelDetalheDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante.atleticaId)
      if (antes.status === StatusNoticia.RASCUNHO) garantirPublicavel(antes)

      const publicadaEm = antes.publicadaEm ?? new Date()
      const { count } = await tx.noticia.updateMany({
        where: { id, status: StatusNoticia.RASCUNHO },
        data: { status: StatusNoticia.PUBLICADA, publicadaEm },
      })
      if (count === 0) return this.paraDto(antes)

      const primeira = antes.publicadaEm === null
      await this.registrarPublicacao(tx, id, publicadaEm, primeira, solicitante)
      return this.paraDto(await this.ler(tx, id))
    })
  }

  /** Idempotente em rascunho (A2). */
  despublicar(id: string, solicitante: Solicitante): Promise<NoticiaPainelDetalheDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante.atleticaId)
      const { count } = await tx.noticia.updateMany({
        where: { id, status: StatusNoticia.PUBLICADA },
        data: { status: StatusNoticia.RASCUNHO },
      })
      if (count === 0) return this.paraDto(antes)

      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_DESPUBLICADA',
        entidadeId: id,
        dados: {
          antes: { status: StatusNoticia.PUBLICADA },
          depois: { status: StatusNoticia.RASCUNHO },
        },
      })
      return this.paraDto(await this.ler(tx, id))
    })
  }

  /** Exclusão lógica em qualquer status (A3); a capa fica no R2. */
  async excluir(id: string, solicitante: Solicitante): Promise<void> {
    await this.transacao.executar(async (tx) => {
      const { titulo, status } = await this.bloquear(tx, id, solicitante.atleticaId)
      await tx.noticia.update({ where: { id }, data: { excluidoEm: new Date() } })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_EXCLUIDA',
        entidadeId: id,
        dados: { antes: { titulo, status }, depois: null },
      })
    })
  }

  private async registrarPublicacao(
    tx: TransacaoComEscopo,
    id: string,
    publicadaEm: Date,
    primeira: boolean,
    { id: autorId, atleticaId }: Solicitante,
  ): Promise<void> {
    await this.auditoria.registrar(tx, {
      entidade: 'Noticia',
      acao: 'NOTICIA_PUBLICADA',
      entidadeId: id,
      dados: {
        antes: { status: StatusNoticia.RASCUNHO },
        depois: { status: StatusNoticia.PUBLICADA, publicadaEm: publicadaEm.toISOString() },
        contexto: { primeiraPublicacao: primeira },
      },
    })
    if (primeira) {
      this.eventos.emitirAposCommit('noticia.publicada', { atleticaId, noticiaId: id, autorId })
    }
  }

  /** O lock serializa edição, publicação e exclusão da mesma notícia. */
  private async bloquear(
    tx: TransacaoComEscopo,
    id: string,
    atleticaId: string,
  ): Promise<LinhaNoticia> {
    const [linha] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Noticia"
      WHERE "id" = ${id}::uuid AND "atleticaId" = ${atleticaId}::uuid AND "excluidoEm" IS NULL
      FOR UPDATE`
    if (!linha) throw erroNoticiaNaoEncontrada()
    return this.ler(tx, id)
  }

  private ler(tx: TransacaoComEscopo, id: string): Promise<LinhaNoticia> {
    return tx.noticia.findUniqueOrThrow({ where: { id }, select: CAMPOS })
  }

  /** Só quando a chave muda (convenções §11.5). */
  private validarCapa(key: string, { id, atleticaId }: Solicitante): Promise<void> {
    return this.uploads.validarKey({
      key,
      finalidade: FinalidadeUpload.NOTICIA,
      usuarioId: id,
      atleticaId,
    })
  }

  private paraItem(noticia: LinhaNoticia): NoticiaPainelDto {
    return {
      id: noticia.id,
      titulo: noticia.titulo,
      status: noticia.status,
      imagemCapaUrl: this.uploads.urlPublica(noticia.imagemCapaKey),
      publicadaEm: noticia.publicadaEm?.toISOString() ?? null,
      criadoEm: noticia.criadoEm.toISOString(),
      atualizadoEm: noticia.atualizadoEm.toISOString(),
      autor: noticia.autor,
    }
  }

  private paraDto(noticia: LinhaNoticia): NoticiaPainelDetalheDto {
    return { ...this.paraItem(noticia), conteudo: noticia.conteudo }
  }
}
