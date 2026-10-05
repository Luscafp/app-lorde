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

/** RN24: só publicadas e não excluídas, sempre (convenções §11.9). */
const VISIVEL = { status: StatusNoticia.PUBLICADA, excluidoEm: null } as const

const ORDEM = [{ publicadaEm: 'desc' }, { id: 'desc' }] as const

const CAMPOS = {
  id: true,
  titulo: true,
  conteudo: true,
  imagemCapaKey: true,
  publicadaEm: true,
} as const

/** O CHECK `noticia_publicada_com_data` garante `publicadaEm` em toda publicada. */
function instante(publicadaEm: Date | null): string {
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

  async listar({ page, limit }: ListarNoticiasQuery): Promise<ListaNoticias> {
    const [noticias, total] = await Promise.all([
      this.prisma.db.noticia.findMany({
        where: VISIVEL,
        orderBy: [...ORDEM],
        skip: (page - 1) * limit,
        take: limit,
        select: CAMPOS,
      }),
      this.prisma.db.noticia.count({ where: VISIVEL }),
    ])

    return {
      items: noticias.map(({ id, titulo, conteudo, imagemCapaKey, publicadaEm }) => ({
        id,
        titulo,
        imagemCapaUrl: this.uploads.urlPublica(imagemCapaKey),
        publicadaEm: instante(publicadaEm),
        resumo: gerarResumo(conteudo),
      })),
      page,
      limit,
      total,
    }
  }

  async detalhar(id: string): Promise<NoticiaDetalheDto> {
    const noticia = await this.prisma.db.noticia.findFirst({
      where: { id, ...VISIVEL },
      select: CAMPOS,
    })
    if (!noticia) throw erroNoticiaNaoEncontrada()

    const { titulo, conteudo, imagemCapaKey, publicadaEm } = noticia
    return {
      id,
      titulo,
      conteudo,
      imagemCapaUrl: this.uploads.urlPublica(imagemCapaKey),
      publicadaEm: instante(publicadaEm),
    }
  }
}
