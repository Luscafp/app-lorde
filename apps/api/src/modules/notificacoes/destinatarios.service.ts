import { Papel, temNivelMinimo } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'

const PAPEIS_DIRETORIA = Object.values(Papel).filter((papel) =>
  temNivelMinimo(papel, Papel.DIRETOR),
)

/**
 * Candidatos a destinatário dos gatilhos (#89, #90, #38), na atlética do contexto; a elegibilidade
 * (conta, dispositivo, preferências) é aplicada depois por `NotificacoesService`.
 */
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

  async diretoria(): Promise<string[]> {
    const vinculos = await this.prisma.db.vinculoAtletica.findMany({
      where: { ativo: true, papel: { in: PAPEIS_DIRETORIA } },
      select: { usuarioId: true },
    })
    return vinculos.map(({ usuarioId }) => usuarioId)
  }

  async todosDaAtletica(): Promise<string[]> {
    const vinculos = await this.prisma.db.vinculoAtletica.findMany({
      where: { ativo: true },
      select: { usuarioId: true },
    })
    return vinculos.map(({ usuarioId }) => usuarioId)
  }
}
