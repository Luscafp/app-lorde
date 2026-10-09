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
import type { UsuarioNaAtletica } from '../auth/tipos'
import { UploadsService } from '../uploads/uploads.service'
import { erroCapaObrigatoria, erroConteudoObrigatorio, erroNoticiaNaoEncontrada } from './erros'
import { CAMPOS_TAGS, garantirTags, idsDasTags, paraTags, substituirTags } from './tags-da-noticia'

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
  tags: CAMPOS_TAGS,
} as const satisfies Prisma.NoticiaSelect

type LinhaNoticia = Prisma.NoticiaGetPayload<{ select: typeof CAMPOS }>

interface Editaveis {
  titulo: string
  conteudo: string
  imagemCapaKey: string | null
}

const EDITAVEIS = ['titulo', 'conteudo', 'imagemCapaKey'] as const

interface Transicao {
  de: StatusNoticia
  dados: (antes: LinhaNoticia) => Prisma.NoticiaUpdateManyMutationInput
  registrar: (tx: TransacaoComEscopo, antes: LinhaNoticia, depois: LinhaNoticia) => Promise<unknown>
}

interface Publicacao {
  noticia: LinhaNoticia
  primeira: boolean
  solicitante: UsuarioNaAtletica
}

/** Requisitos de publicação (convenções §11.4 e §11.9). */
function garantirPublicavel({ conteudo, imagemCapaKey }: Editaveis): void {
  if (!imagemCapaKey) throw erroCapaObrigatoria()
  if (conteudo.trim().length === 0) throw erroConteudoObrigatorio()
}

/** `$queryRaw` não passa pela extensão multi-atlética: o filtro de atlética vai no SQL. */
function filtrosDaLista(atleticaId: string, { status, q, tagId }: NoticiasPainelQuery): Prisma.Sql {
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
  if (tagId) {
    condicoes.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "NoticiaTag" nt WHERE nt."noticiaId" = n."id" AND nt."tagId" = ${tagId}::uuid)`,
    )
  }
  return Prisma.join(condicoes, ' AND ')
}

interface TrocaDeTags {
  antes: string[]
  depois: string[]
}

/** Sem o conteúdo nem a chave da capa (convenções §7): só o título, as tags e indicadores. */
function dadosDaAlteracao(diff: DiferencaAuditoria | null, tags?: TrocaDeTags): DadosAuditoria {
  const { antes, depois } = diff ?? { antes: {}, depois: {} }
  const titulo = 'titulo' in depois
  return {
    antes: {
      ...(titulo && { titulo: antes.titulo }),
      ...(tags && { tagIds: tags.antes }),
    },
    depois: {
      ...(titulo && { titulo: depois.titulo }),
      ...('conteudo' in depois && { conteudoAlterado: true }),
      ...('imagemCapaKey' in depois && { capaAlterada: true }),
      ...(tags && { tagIds: tags.depois }),
    },
  }
}

function mesmasTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i])
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

  async criar(
    solicitante: UsuarioNaAtletica,
    entrada: NoticiaCriacao,
  ): Promise<NoticiaPainelDetalheDto> {
    const { publicar = false, titulo, conteudo = '', imagemCapaKey = null, tags = [] } = entrada
    if (publicar) garantirPublicavel({ titulo, conteudo, imagemCapaKey })
    if (imagemCapaKey) await this.validarCapa(imagemCapaKey, solicitante)

    return this.transacao.executar(async (tx) => {
      const publicadaEm = publicar ? new Date() : null
      const tagIds = await garantirTags(tx, solicitante.atleticaId, tags)
      const criada = await tx.noticia.create({
        data: {
          titulo,
          conteudo,
          imagemCapaKey,
          atleticaId: solicitante.atleticaId,
          autorId: solicitante.id,
          ...(publicadaEm && { status: StatusNoticia.PUBLICADA, publicadaEm }),
          ...(tagIds.length > 0 && { tags: { create: tagIds.map((tagId) => ({ tagId })) } }),
        },
        select: CAMPOS,
      })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_CRIADA',
        entidadeId: criada.id,
        dados: {
          antes: null,
          depois: { titulo, status: criada.status, ...(tagIds.length > 0 && { tagIds }) },
        },
      })
      if (publicadaEm) {
        await this.registrarPublicacao(tx, { noticia: criada, primeira: true, solicitante })
      }
      return this.paraDto(criada)
    })
  }

  /** Publicada continua atendendo aos requisitos; `publicadaEm` e o status não mudam (A1). */
  async atualizar(
    id: string,
    solicitante: UsuarioNaAtletica,
    entrada: NoticiaAtualizacao,
  ): Promise<NoticiaPainelDetalheDto> {
    const capaValidada = await this.validarCapaNova(id, entrada.imagemCapaKey, solicitante)
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante)
      const depois: Editaveis = {
        titulo: entrada.titulo ?? antes.titulo,
        conteudo: entrada.conteudo ?? antes.conteudo,
        imagemCapaKey:
          entrada.imagemCapaKey === undefined ? antes.imagemCapaKey : entrada.imagemCapaKey,
      }
      const diff = diferenca<Editaveis>(antes, depois, EDITAVEIS)
      const tags = await this.trocaDeTags(tx, antes, solicitante, entrada.tags)
      if (!diff && !tags) return this.paraDto(antes)

      if (diff && antes.status === StatusNoticia.PUBLICADA) garantirPublicavel(depois)
      const capaAnterior = antes.imagemCapaKey
      const trocouCapa = depois.imagemCapaKey !== capaAnterior
      if (trocouCapa && depois.imagemCapaKey && depois.imagemCapaKey !== capaValidada) {
        await this.validarCapa(depois.imagemCapaKey, solicitante)
      }

      if (tags) await substituirTags(tx, id, tags.depois)
      const atualizada = await tx.noticia.update({ where: { id }, data: depois, select: CAMPOS })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_ALTERADA',
        entidadeId: id,
        dados: dadosDaAlteracao(diff, tags),
      })
      if (trocouCapa && capaAnterior) aposCommit(() => this.uploads.remover(capaAnterior))
      return this.paraDto(atualizada)
    })
  }

  /** Idempotente; a republicação mantém `publicadaEm` e não emite `noticia.publicada`. */
  publicar(id: string, solicitante: UsuarioNaAtletica): Promise<NoticiaPainelDetalheDto> {
    return this.transicionar(id, solicitante, {
      de: StatusNoticia.RASCUNHO,
      dados: (antes) => {
        garantirPublicavel(antes)
        return { status: StatusNoticia.PUBLICADA, publicadaEm: antes.publicadaEm ?? new Date() }
      },
      registrar: (tx, antes, noticia) =>
        this.registrarPublicacao(tx, {
          noticia,
          primeira: antes.publicadaEm === null,
          solicitante,
        }),
    })
  }

  /** Idempotente em rascunho (A2). */
  despublicar(id: string, solicitante: UsuarioNaAtletica): Promise<NoticiaPainelDetalheDto> {
    return this.transicionar(id, solicitante, {
      de: StatusNoticia.PUBLICADA,
      dados: () => ({ status: StatusNoticia.RASCUNHO }),
      registrar: (tx) =>
        this.auditoria.registrar(tx, {
          entidade: 'Noticia',
          acao: 'NOTICIA_DESPUBLICADA',
          entidadeId: id,
          dados: {
            antes: { status: StatusNoticia.PUBLICADA },
            depois: { status: StatusNoticia.RASCUNHO },
          },
        }),
    })
  }

  /** Exclusão lógica em qualquer status (A3); a capa fica no R2. */
  async excluir(id: string, solicitante: UsuarioNaAtletica): Promise<void> {
    await this.transacao.executar(async (tx) => {
      const { titulo, status } = await this.bloquear(tx, id, solicitante)
      await tx.noticia.update({ where: { id }, data: { excluidoEm: new Date() } })
      await this.auditoria.registrar(tx, {
        entidade: 'Noticia',
        acao: 'NOTICIA_EXCLUIDA',
        entidadeId: id,
        dados: { antes: { titulo, status }, depois: null },
      })
    })
  }

  /** Lock, `updateMany` condicionado ao status de origem e auditoria só quando muda. */
  private transicionar(
    id: string,
    solicitante: UsuarioNaAtletica,
    { de, dados, registrar }: Transicao,
  ): Promise<NoticiaPainelDetalheDto> {
    return this.transacao.executar(async (tx) => {
      const antes = await this.bloquear(tx, id, solicitante)
      if (antes.status !== de) return this.paraDto(antes)

      await tx.noticia.updateMany({ where: { id, status: de }, data: dados(antes) })
      const depois = await this.ler(tx, id)
      await registrar(tx, antes, depois)
      return this.paraDto(depois)
    })
  }

  private async registrarPublicacao(
    tx: TransacaoComEscopo,
    { noticia, primeira, solicitante }: Publicacao,
  ): Promise<void> {
    await this.auditoria.registrar(tx, {
      entidade: 'Noticia',
      acao: 'NOTICIA_PUBLICADA',
      entidadeId: noticia.id,
      dados: {
        antes: { status: StatusNoticia.RASCUNHO },
        depois: {
          status: StatusNoticia.PUBLICADA,
          publicadaEm: noticia.publicadaEm?.toISOString() ?? null,
        },
        contexto: { primeiraPublicacao: primeira },
      },
    })
    if (primeira) {
      this.eventos.emitirAposCommit('noticia.publicada', {
        atleticaId: solicitante.atleticaId,
        noticiaId: noticia.id,
        autorId: solicitante.id,
      })
    }
  }

  /** O lock serializa edição, publicação e exclusão da mesma notícia. */
  private async bloquear(
    tx: TransacaoComEscopo,
    id: string,
    { atleticaId }: UsuarioNaAtletica,
  ): Promise<LinhaNoticia> {
    const [linha] = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Noticia"
      WHERE "id" = ${id}::uuid AND "atleticaId" = ${atleticaId}::uuid AND "excluidoEm" IS NULL
      FOR UPDATE`
    if (!linha) throw erroNoticiaNaoEncontrada()
    return this.ler(tx, id)
  }

  /** `undefined` quando `tags` não foi enviado ou o conjunto não muda. */
  private async trocaDeTags(
    tx: TransacaoComEscopo,
    antes: LinhaNoticia,
    { atleticaId }: UsuarioNaAtletica,
    nomes: string[] | undefined,
  ): Promise<TrocaDeTags | undefined> {
    if (nomes === undefined) return undefined
    const atuais = idsDasTags(antes.tags)
    const novas = await garantirTags(tx, atleticaId, nomes)
    return mesmasTags(atuais, novas) ? undefined : { antes: atuais, depois: novas }
  }

  private ler(tx: TransacaoComEscopo, id: string): Promise<LinhaNoticia> {
    return tx.noticia.findUniqueOrThrow({ where: { id }, select: CAMPOS })
  }

  /** Fora da transação, para o `HeadObject` no R2 não segurar o lock da notícia. */
  private async validarCapaNova(
    id: string,
    key: string | null | undefined,
    solicitante: UsuarioNaAtletica,
  ): Promise<string | null> {
    if (!key) return null
    const atual = await this.prisma.db.noticia.findFirst({
      where: { id, ...naoExcluido },
      select: { imagemCapaKey: true },
    })
    if (!atual || atual.imagemCapaKey === key) return null
    await this.validarCapa(key, solicitante)
    return key
  }

  /** Só quando a chave muda (convenções §11.5). */
  private validarCapa(key: string, { id, atleticaId }: UsuarioNaAtletica): Promise<void> {
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
      tags: paraTags(noticia.tags),
    }
  }

  private paraDto(noticia: LinhaNoticia): NoticiaPainelDetalheDto {
    return { ...this.paraItem(noticia), conteudo: noticia.conteudo }
  }
}
