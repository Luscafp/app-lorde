import { Papel, temNivelMinimo } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { PrismaService } from '../../infra/prisma/prisma.service'

const PAPEIS_DIRETORIA = Object.values(Papel).filter((papel) =>
  temNivelMinimo(papel, Papel.DIRETOR),
)

/** Candidatos a destinatário dos gatilhos (#89, #90, #38); a elegibilidade vem depois. */
@Injectable()
export class DestinatariosService {
  constructor(private readonly prisma: PrismaService) {}

  async elencoDoTime(timeId: string): Promise<string[]> {
    const membros = await this.prisma.db.membroTime.findMany({
      where: { timeId, saidaEm: null },
      select: { usuarioId: true },
    })
    return membros.map(({ usuarioId }) => usuarioId)
  }

  diretoria(atleticaId: string): Promise<string[]> {
    return this.vinculosAtivos({ atleticaId, papel: { in: PAPEIS_DIRETORIA } })
  }

  todosDaAtletica(atleticaId: string): Promise<string[]> {
    return this.vinculosAtivos({ atleticaId })
  }

  private async vinculosAtivos(where: Prisma.VinculoAtleticaWhereInput): Promise<string[]> {
    const vinculos = await this.prisma.db.vinculoAtletica.findMany({
      where: { ...where, ativo: true },
      select: { usuarioId: true },
    })
    return vinculos.map(({ usuarioId }) => usuarioId)
  }
}
