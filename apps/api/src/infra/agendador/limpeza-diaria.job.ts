import { FUSO_PADRAO } from '@atletica/shared'
import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { PrismaService } from '../prisma/prisma.service'

export const JOB_LIMPEZA_DIARIA = 'manutencao.limpeza-diaria'
const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS
export const RETENCAO_TENTATIVAS_MS = DIA_MS
export const RETENCAO_SESSOES_ENCERRADAS_MS = 30 * DIA_MS

export interface ResultadoLimpeza {
  tentativasAcesso: number
  sessoes: number
}

/** Apaga dados de autenticação vencidos (épico #10 §14). A #62 acrescenta `CodigoVerificacao`. */
@Injectable()
export class LimpezaDiariaJob {
  private readonly logger = new Logger(LimpezaDiariaJob.name)

  constructor(private readonly prisma: PrismaService) {}

  /** O `cron` chama o `onTick` com argumentos próprios: o relógio fica em `limpar`. */
  @Cron('0 3 * * *', { name: JOB_LIMPEZA_DIARIA, timeZone: FUSO_PADRAO })
  async executar(): Promise<void> {
    try {
      await this.limpar()
    } catch (erro) {
      this.logger.error({ err: erro, job: JOB_LIMPEZA_DIARIA }, 'Falha na limpeza diária')
    }
  }

  async limpar(agora: Date = new Date()): Promise<ResultadoLimpeza> {
    const limiteTentativas = new Date(agora.getTime() - RETENCAO_TENTATIVAS_MS)
    const limiteSessoes = new Date(agora.getTime() - RETENCAO_SESSOES_ENCERRADAS_MS)
    const db = this.prisma.semEscopo

    const tentativas = await db.tentativaAcesso.deleteMany({
      where: { criadoEm: { lt: limiteTentativas } },
    })
    const sessoes = await db.sessao.deleteMany({
      where: { OR: [{ expiraEm: { lt: limiteSessoes } }, { revogadaEm: { lt: limiteSessoes } }] },
    })

    const resultado = { tentativasAcesso: tentativas.count, sessoes: sessoes.count }
    this.logger.log({ job: JOB_LIMPEZA_DIARIA, ...resultado }, 'Limpeza diária concluída')
    return resultado
  }
}
