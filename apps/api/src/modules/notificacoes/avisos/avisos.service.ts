import {
  DestinoAviso,
  rotaNotificacao,
  type AlcanceAviso,
  type AlcanceAvisoQuery,
  type AvisoEnviado,
  type EnviarAviso,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { TransacaoService } from '../../../infra/eventos/apos-commit'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { AuditoriaService } from '../../auditoria/auditoria.service'
import {
  RateLimitService,
  TipoTentativa,
  type LimiteTentativas,
} from '../../auth/rate-limit.service'
import type { UsuarioNaAtletica } from '../../auth/tipos'
import { DestinatariosService } from '../destinatarios.service'
import { NotificacoesService } from '../notificacoes.service'
import { erroTimeNaoEncontrado } from '../../times/erros'
import { erroTimeInvalidoAviso } from './erros'

export const LIMITE_AVISOS: LimiteTentativas = { maximo: 10, janelaMs: 60 * 60_000 }

const CATEGORIA = 'AVISOS'

/** Avisos manuais da diretoria (RF39, UC25); o registro do envio é a auditoria (sem tabela). */
@Injectable()
export class AvisosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly limites: RateLimitService,
    private readonly destinatarios: DestinatariosService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  async alcance(
    { atleticaId }: UsuarioNaAtletica,
    { timeId }: AlcanceAvisoQuery,
  ): Promise<AlcanceAviso> {
    const usuarioIds = await this.resolverDestinatarios(atleticaId, timeId ?? null)
    const destinatarios = await this.notificacoes.contarElegiveis({
      atleticaId,
      categoria: CATEGORIA,
      usuarioIds,
    })
    return { destinatarios }
  }

  /** Audita na transação e só enfileira após o commit: todo aviso enviado está auditado. */
  async enviar(remetente: UsuarioNaAtletica, aviso: EnviarAviso): Promise<AvisoEnviado> {
    const { atleticaId } = remetente
    const timeId = aviso.destino === DestinoAviso.TIME ? aviso.timeId : null
    const usuarioIds = await this.resolverDestinatarios(atleticaId, timeId)
    await this.limites.consumir(
      TipoTentativa.AVISO_ENVIO,
      `${atleticaId}:${remetente.id}`,
      LIMITE_AVISOS,
    )
    const elegiveis = await this.notificacoes.listarElegiveis({
      atleticaId,
      categoria: CATEGORIA,
      usuarioIds,
    })
    const destinatarios = elegiveis.length
    const avisoId = randomUUID()
    const { titulo, mensagem, destino } = aviso

    await this.transacao.executar((tx) =>
      this.auditoria.registrar(tx, {
        acao: 'AVISO_ENVIADO',
        entidade: 'Aviso',
        entidadeId: avisoId,
        dados: { antes: null, depois: { titulo, mensagem, destino, timeId, destinatarios } },
      }),
    )
    await this.notificacoes.notificar({
      atleticaId,
      categoria: CATEGORIA,
      usuarioIds: elegiveis,
      titulo,
      corpo: mensagem,
      url: rotaNotificacao(timeId ? { tela: 'time', id: timeId } : { tela: 'inicio' }),
      chave: `aviso:${avisoId}`,
    })
    return { avisoId, destinatarios, enviadoEm: new Date().toISOString() }
  }

  /** Sem time: todos os vínculos ativos; com time: o elenco atual de um time ativo da atlética. */
  private async resolverDestinatarios(
    atleticaId: string,
    timeId: string | null,
  ): Promise<string[]> {
    if (!timeId) return this.destinatarios.todosDaAtletica(atleticaId)
    const time = await this.prisma.db.time.findUnique({
      where: { id: timeId },
      select: { atleticaId: true, ativo: true },
    })
    if (!time) throw erroTimeNaoEncontrado()
    if (time.atleticaId !== atleticaId || !time.ativo) throw erroTimeInvalidoAviso()
    return this.destinatarios.elencoDoTime(timeId)
  }
}
