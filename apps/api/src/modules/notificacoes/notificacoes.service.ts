import { Injectable } from '@nestjs/common'
import type { Prisma } from '../../generated/prisma/client'
import { FilaService } from '../../infra/fila/fila.service'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { COLUNA_PREFERENCIA, type CategoriaNotificacao } from './categorias'
import { dividirEmLotes, montarMensagem, type ConteudoNotificacao } from './envio/mensagens'

export interface FiltroDestinatarios {
  atleticaId: string
  categoria: CategoriaNotificacao
  usuarioIds: string[]
}

/** `chave` identifica o envio (ex.: `evento.criado:<eventoId>`): repetir a chave não duplica lotes pendentes. */
export type EntradaNotificacao = FiltroDestinatarios & Omit<ConteudoNotificacao, 'categoria'>

/** Contrato do épico #36 §7, usado por #89, #90 e #38. */
@Injectable()
export class NotificacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fila: FilaService,
  ) {}

  /** Uma mensagem por aparelho dos elegíveis, em lotes de 100 na fila `notificacao.enviar-lote`. */
  async notificar(entrada: EntradaNotificacao): Promise<{ destinatarios: number }> {
    if (entrada.usuarioIds.length === 0) return { destinatarios: 0 }
    const usuarios = await this.prisma.db.usuario.findMany({
      where: this.filtroElegiveis(entrada),
      select: { dispositivos: { select: { id: true, tokenPush: true }, orderBy: { id: 'asc' } } },
      orderBy: { id: 'asc' },
    })
    const dispositivos = usuarios.flatMap((usuario) => usuario.dispositivos)
    const lotes = dividirEmLotes(dispositivos)
    for (const [indice, lote] of lotes.entries()) {
      await this.fila.enviar(
        'notificacao.enviar-lote',
        {
          mensagens: lote.map(({ tokenPush }) => montarMensagem(tokenPush, entrada)),
          dispositivoIds: lote.map(({ id }) => id),
        },
        { singletonKey: `${entrada.chave}:${indice}` },
      )
    }
    return { destinatarios: usuarios.length }
  }

  /** Mesmo filtro de `notificar`, sem enfileirar (prévia de alcance da #38). */
  contarElegiveis(filtro: FiltroDestinatarios): Promise<number> {
    if (filtro.usuarioIds.length === 0) return Promise.resolve(0)
    return this.prisma.db.usuario.count({ where: this.filtroElegiveis(filtro) })
  }

  /** Épico #36 §3.3; preferência ausente = padrões (tudo ligado); `CARGO` ignora preferências (RN35). */
  private filtroElegiveis({
    atleticaId,
    categoria,
    usuarioIds,
  }: FiltroDestinatarios): Prisma.UsuarioWhereInput {
    return {
      id: { in: [...new Set(usuarioIds)] },
      ativo: true,
      excluidoEm: null,
      vinculos: { some: { atleticaId, ativo: true } },
      dispositivos: { some: {} },
      ...(categoria !== 'CARGO' && {
        OR: [
          { preferencia: { is: null } },
          { preferencia: { is: { pushAtivo: true, [COLUNA_PREFERENCIA[categoria]]: true } } },
        ],
      }),
    }
  }
}
