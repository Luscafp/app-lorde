import {
  StatusNoticia,
  type ListaNoticias,
  type ListarNoticiasQuery,
  type NoticiaDetalheDto,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { UploadsService } from '../uploads/uploads.service'
import { erroNoticiaNaoEncontrada } from './erros'
import { gerarResumo } from './resumo'
import { CAMPOS_TAGS, paraTags } from './tags-da-noticia'

/** RN24: só publicadas e não excluídas, sempre (convenções §11.9). */
const VISIVEL = { status: StatusNoticia.PUBLICADA, excluidoEm: null } as const

const ORDEM = [{ publicadaEm: 'desc' }, { id: 'desc' }] as const

const CAMPOS_NOTICIA = {
  id: true,
  titulo: true,
  conteudo: true,
  imagemCapaKey: true,
  publicadaEm: true,
  tags: CAMPOS_TAGS,
} as const

/** O CHECK `noticia_publicada_com_data` garante `publicadaEm` em toda publicada. */
function publicadaEmIso(publicadaEm: Date | null): string {
  if (!publicadaEm) throw new Error('Notícia publicada sem publicadaEm')
  return publicadaEm.toISOString()
}

/** Leitura das notícias publicadas para qualquer papel (UC05, issue #78). */
@Injectable()
export class NoticiasPublicasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
  ) {}

  /** Só tags da atlética são associadas: `tagId` alheio ou inexistente resulta em lista vazia. */
  async listar({ page, limit, tagId }: ListarNoticiasQuery): Promise<ListaNoticias> {
    const where = { ...VISIVEL, ...(tagId && { tags: { some: { tagId } } }) }
    const [noticias, total] = await Promise.all([
      this.prisma.db.noticia.findMany({
        where,
        orderBy: [...ORDEM],
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPOS_NOTICIA,
      }),
      this.prisma.db.noticia.count({ where }),
    ])

    return {
      items: noticias.map(({ id, titulo, conteudo, imagemCapaKey, publicadaEm, tags }) => ({
        id,
        titulo,
        imagemCapaUrl: this.uploads.urlPublica(imagemCapaKey),
        publicadaEm: publicadaEmIso(publicadaEm),
        resumo: gerarResumo(conteudo),
        tags: paraTags(tags),
      })),
      page,
      limit,
      total,
    }
  }

  async detalhar(id: string): Promise<NoticiaDetalheDto> {
    const noticia = await this.prisma.db.noticia.findFirst({
      where: { id, ...VISIVEL },
      select: CAMPOS_NOTICIA,
    })
    if (!noticia) throw erroNoticiaNaoEncontrada()

    const { titulo, conteudo, imagemCapaKey, publicadaEm, tags } = noticia
    return {
      id,
      titulo,
      conteudo,
      imagemCapaUrl: this.uploads.urlPublica(imagemCapaKey),
      publicadaEm: publicadaEmIso(publicadaEm),
      tags: paraTags(tags),
    }
  }
}
