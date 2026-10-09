import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { MINUTO_MS } from '../../../common/tempo'
import type { FilasDominio } from '../../../infra/fila/filas-dominio'
import { FilaService } from '../../../infra/fila/fila.service'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { capturarErroJob } from '../../../infra/sentry/sentry'
import { ClienteExpoPush, type ReciboPush, type TicketPush } from './cliente-expo-push'

const FILA_LOTE = 'notificacao.enviar-lote'
const FILA_RECIBOS = 'notificacao.recibos'
export const ESPERA_RECIBOS_MS = 15 * MINUTO_MS

/** Erros de configuração do envio: vão ao Sentry (épico #36 §3.6 item 17). */
const ERROS_DE_CONFIGURACAO = new Set(['MessageTooBig', 'InvalidCredentials', 'MismatchSenderId'])

export class ErroExpoPush extends Error {
  override readonly name = 'ErroExpoPush'
}

type Erro = Extract<TicketPush | ReciboPush, { status: 'error' }>

/** Rede, 5xx e 429 voltam ao pg-boss (retry com backoff); os demais erros não se repetem. */
export function ehFalhaTemporaria(erro: unknown): boolean {
  const status = (erro as { statusCode?: unknown } | null)?.statusCode
  return typeof status !== 'number' || status >= 500 || status === 429
}

/** Workers do envio: lote → Expo → tickets → recibos (épico #36 §3.6). */
@Injectable()
export class EntregaPushService implements OnModuleInit {
  private readonly logger = new Logger(EntregaPushService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: FilaService,
    private readonly cliente: ClienteExpoPush,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.fila.criarFila(FILA_LOTE, { policy: 'exclusive', retryLimit: 3, retryBackoff: true })
    await this.fila.criarFila(FILA_RECIBOS, { retryLimit: 3, retryBackoff: true })
    await this.fila.trabalhar(FILA_LOTE, (payload) => this.enviarLote(payload))
    await this.fila.trabalhar(FILA_RECIBOS, (payload) => this.processarRecibos(payload))
  }

  /** Só a requisição ao Expo é repetida: depois dela, nenhum erro reenvia o lote. */
  async enviarLote({
    mensagens,
    dispositivoIds,
  }: FilasDominio['notificacao.enviar-lote']): Promise<void> {
    let tickets: TicketPush[]
    try {
      tickets = await this.cliente.enviar(mensagens)
    } catch (erro) {
      if (ehFalhaTemporaria(erro)) throw erro
      const { statusCode, code } = erro as { statusCode: number; code?: string }
      const resumo = new ErroExpoPush(`HTTP ${statusCode} ${code ?? ''}`.trim())
      this.logger.error({ err: resumo, fila: FILA_LOTE }, 'Expo recusou o lote')
      capturarErroJob(FILA_LOTE, resumo, { mensagens: mensagens.length })
      return
    }

    try {
      const aceitos: FilasDominio['notificacao.recibos']['tickets'] = []
      const invalidos: string[] = []
      for (const [indice, ticket] of tickets.entries()) {
        const dispositivoId = dispositivoIds[indice]
        if (!dispositivoId) continue
        if (ticket.status === 'ok') aceitos.push({ ticketId: ticket.id, dispositivoId })
        else if (this.tratarErro(FILA_LOTE, ticket, dispositivoId)) invalidos.push(dispositivoId)
      }
      await this.apagar(invalidos)
      if (aceitos.length > 0) {
        await this.fila.enviar(
          FILA_RECIBOS,
          { tickets: aceitos },
          { startAfter: new Date(Date.now() + ESPERA_RECIBOS_MS) },
        )
      }
    } catch (erro) {
      this.logger.error({ err: erro, fila: FILA_LOTE }, 'Falha após o envio do lote')
      capturarErroJob(FILA_LOTE, erro)
    }
  }

  async processarRecibos({ tickets }: FilasDominio['notificacao.recibos']): Promise<void> {
    const recibos = await this.cliente.consultarRecibos(tickets.map(({ ticketId }) => ticketId))
    const invalidos: string[] = []
    for (const { ticketId, dispositivoId } of tickets) {
      const recibo = recibos[ticketId]
      if (recibo?.status !== 'error') continue
      if (this.tratarErro(FILA_RECIBOS, recibo, dispositivoId)) invalidos.push(dispositivoId)
    }
    await this.apagar(invalidos)
  }

  /** Devolve `true` quando o token deve ser apagado. A `message` do Expo cita o token: não é logada. */
  private tratarErro(fila: string, { details }: Erro, dispositivoId: string): boolean {
    const codigo: string = details?.error ?? 'desconhecido'
    if (codigo === 'DeviceNotRegistered') return true
    if (codigo === 'MessageRateExceeded') {
      this.logger.warn({ fila, dispositivoId, codigo }, 'Expo: limite de mensagens excedido')
    } else if (ERROS_DE_CONFIGURACAO.has(codigo)) {
      this.logger.error({ fila, dispositivoId, codigo }, 'Expo: erro de configuração do push')
      capturarErroJob(fila, new ErroExpoPush(codigo), { dispositivoId, codigo })
    } else {
      this.logger.warn({ fila, dispositivoId, codigo }, 'Expo: mensagem não entregue')
    }
    return false
  }

  private async apagar(dispositivoIds: string[]): Promise<void> {
    if (dispositivoIds.length === 0) return
    const { count } = await this.prisma.db.dispositivoPush.deleteMany({
      where: { id: { in: dispositivoIds } },
    })
    this.logger.log({ dispositivos: count }, 'Tokens push inválidos removidos')
  }
}
