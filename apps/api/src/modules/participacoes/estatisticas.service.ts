import type { EstatisticasAtleta } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../infra/prisma/prisma.service'

interface Contagens {
  jogos: bigint
  treinos: bigint
  chamadas: bigint
}

/** Recomendação (a) do épico #35 §14, pendente de confirmação na #97. */
export function taxaPresenca(presencas: number, chamadas: number): number | null {
  return chamadas === 0 ? null : Math.round((100 * presencas) / chamadas)
}

/** RF26/RN32: só `presente` conta; eventos cancelados ou excluídos ficam fora (épico #35 §3.2). */
@Injectable()
export class EstatisticasService {
  constructor(private readonly prisma: PrismaService) {}

  /** `$queryRaw` não passa pela extensão multi-atlética: o `atleticaId` vai no SQL. */
  async calcular(usuarioId: string, atleticaId: string): Promise<EstatisticasAtleta> {
    const [linha] = await this.prisma.db.$queryRaw<Contagens[]>`
      SELECT
        count(*) FILTER (WHERE p."presente" AND e."tipo" = 'JOGO') AS "jogos",
        count(*) FILTER (WHERE p."presente" AND e."tipo" = 'TREINO') AS "treinos",
        count(*) FILTER (WHERE p."presencaRegistradaEm" IS NOT NULL) AS "chamadas"
      FROM "Participacao" p JOIN "Evento" e ON e."id" = p."eventoId"
      WHERE p."usuarioId" = ${usuarioId}::uuid AND p."atleticaId" = ${atleticaId}::uuid
        AND e."status" <> 'CANCELADO' AND e."excluidoEm" IS NULL`
    const jogosParticipados = Number(linha?.jogos ?? 0)
    const treinosPresentes = Number(linha?.treinos ?? 0)
    const eventosComChamada = Number(linha?.chamadas ?? 0)
    return {
      jogosParticipados,
      treinosPresentes,
      eventosComChamada,
      taxaPresenca: taxaPresenca(jogosParticipados + treinosPresentes, eventosComChamada),
    }
  }
}
