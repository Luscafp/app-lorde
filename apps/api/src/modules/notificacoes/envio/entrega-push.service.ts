import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { MINUTO_MS } from '../../../common/tempo'
import type { FilasDominio } from '../../../infra/fila/filas-dominio'
import { FilaService } from '../../../infra/fila/fila.service'
import { capturarErroJob } from '../../../infra/sentry/sentry'
import { DispositivosService } from '../dispositivos/dispositivos.service'
import { ClienteExpoPush, type ReciboPush, type TicketPush } from './cliente-expo-push'

export const FILA_LOTE = 'notificacao.enviar-lote'
const FILA_RECIBOS = 'notificacao.recibos'
export const ESPERA_RECIBOS_MS = 15 * MINUTO_MS

export class ErroExpoPush extends Error {
  override readonly name = 'ErroExpoPush'
}

type Erro = Extract<TicketPush | ReciboPush, { status: 'error' }>

/** Rede (`fetch failed` do undici), 5xx e 429 voltam ao pg-boss; os demais erros não se repetem. */
export function ehFalhaTemporaria(erro: unknown): boolean {
  const status = (erro as { statusCode?: unknown } | null)?.statusCode
  if (typeof status === 'number') return status >= 500 || status === 429
  return erro instanceof TypeError && erro.message === 'fetch failed'
}

/** Recusa HTTP vira só status e código: a mensagem do Expo pode citar tokens. */
function resumirRecusa(erro: unknown): unknown {
  const { statusCode, code } = erro as { statusCode?: unknown; code?: string }
  if (typeof statusCode !== 'number') return erro
  return new ErroExpoPush(`HTTP ${statusCode} ${code ?? ''}`.trim())
}

/** Workers do envio: lote → Expo → tickets → recibos (épico #36 §3.6). */
@Injectable()
export class EntregaPushService implements OnModuleInit {
  private readonly logger = new Logger(EntregaPushService.name)

  constructor(
    private readonly fila: FilaService,
    private readonly cliente: ClienteExpoPush,
    private readonly dispositivos: DispositivosService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.fila.criarFila(FILA_LOTE, { policy: 'exclusive', retryLimit: 3, retryBackoff: true })
    await this.fila.criarFila(FILA_RECIBOS, { retryLimit: 3, retryBackoff: true })
    await this.fila.trabalhar(FILA_LOTE, (payload) => this.enviarLote(payload))
    await this.fila.trabalhar(FILA_RECIBOS, (payload) => this.processarRecibos(payload))
  }

  /** Só a requisição ao Expo é repetida: depois dela, nenhum erro reenvia o lote. */
  async enviarLote({ entregas }: FilasDominio[typeof FILA_LOTE]): Promise<void> {
    let tickets: TicketPush[]
    try {
      tickets = await this.cliente.enviar(entregas.map(({ mensagem }) => mensagem))
    } catch (erro) {
      if (ehFalhaTemporaria(erro)) throw erro
      const resumo = resumirRecusa(erro)
      this.logger.error({ err: resumo, fila: FILA_LOTE }, 'Falha no envio do lote ao Expo')
      capturarErroJob(FILA_LOTE, resumo, { mensagens: entregas.length })
      return
    }

    try {
      const aceitos: FilasDominio[typeof FILA_RECIBOS]['tickets'] = []
      const invalidos: string[] = []
      for (const [indice, { dispositivoId }] of entregas.entries()) {
        const ticket = tickets[indice]
        if (!ticket) continue
        if (ticket.status === 'ok') aceitos.push({ ticketId: ticket.id, dispositivoId })
        else if (this.tratarErro(FILA_LOTE, ticket, dispositivoId)) invalidos.push(dispositivoId)
      }
      await this.dispositivos.removerInvalidos(invalidos)
      if (aceitos.length > 0) {
        await this.fila.enviar(
          FILA_RECIBOS,
          { tickets: aceitos },
          { startAfter: new Date(Date.now() + ESPERA_RECIBOS_MS) },
        )
      }
    } catch (erro) {
      // Os recibos deste lote se perdem: repetir o job reenviaria as mensagens.
      this.logger.error({ err: erro, fila: FILA_LOTE }, 'Falha após o envio do lote')
      capturarErroJob(FILA_LOTE, erro)
    }
  }

  /** Ticket ainda sem recibo é ignorado: o Expo entrega quase todos em até 15 min. */
  async processarRecibos({ tickets }: FilasDominio[typeof FILA_RECIBOS]): Promise<void> {
    const recibos = await this.cliente.consultarRecibos(tickets.map(({ ticketId }) => ticketId))
    const invalidos: string[] = []
    for (const { ticketId, dispositivoId } of tickets) {
      const recibo = recibos[ticketId]
      if (recibo?.status !== 'error') continue
      if (this.tratarErro(FILA_RECIBOS, recibo, dispositivoId)) invalidos.push(dispositivoId)
    }
    await this.dispositivos.removerInvalidos(invalidos)
  }

  /** `true` = apagar o token. A `message` do Expo cita o token: não é logada. */
  private tratarErro(fila: string, { details }: Erro, dispositivoId: string): boolean {
    const codigo: string = details?.error ?? 'desconhecido'
    if (codigo === 'DeviceNotRegistered') return true
    if (codigo === 'MessageRateExceeded') {
      this.logger.warn({ fila, dispositivoId, codigo }, 'Expo: limite de mensagens excedido')
    } else {
      this.logger.error({ fila, dispositivoId, codigo }, 'Expo: mensagem não entregue')
      capturarErroJob(fila, new ErroExpoPush(codigo), { dispositivoId, codigo })
    }
    return false
  }
}
