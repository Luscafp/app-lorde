import {
  VALIDADE_CODIGO_VERIFICACAO_MS,
  type RespostaEnvioVerificacao,
  type RespostaVerificarEmail,
  type VerificarEmailEntrada,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { ErroLimiteExcedido } from '../../../common/erros/erro-negocio'
import { HORA_MS, MINUTO_MS } from '../../../common/tempo'
import { TipoCodigoVerificacao } from '../../../generated/prisma/enums'
import { CodigoVerificacaoService } from '../../../infra/email/codigo-verificacao'
import { EmailService } from '../../../infra/email/email.service'
import { mascararEmail } from '../../../infra/email/mascarar-email'
import { renderizar } from '../../../infra/email/templates/base'
import { verificacaoEmail } from '../../../infra/email/templates/verificacao-email'
import { PrismaService } from '../../../infra/prisma/prisma.service'
import { erroCodigoExpirado, erroCodigoInvalido, erroEmailJaVerificado } from '../erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from '../rate-limit.service'
import type { UsuarioNaAtletica } from '../tipos'

export const MAXIMO_TENTATIVAS_VERIFICACAO = 5
/** O envio do cadastro também conta. */
export const LIMITE_ENVIOS_HORA: LimiteTentativas = { maximo: 3, janelaMs: HORA_MS }
export const INTERVALO_ENVIO: LimiteTentativas = { maximo: 1, janelaMs: MINUTO_MS }

const TIPO_CODIGO = TipoCodigoVerificacao.VERIFICAR_EMAIL
const TIPO_LIMITE = TipoTentativa.VERIFICACAO_ENVIO
const LIMITES_ENVIO = [LIMITE_ENVIOS_HORA, INTERVALO_ENVIO]

function erroLimiteEnvio(liberadoEm: Date, agora: Date): ErroLimiteExcedido {
  const segundos = Math.ceil((liberadoEm.getTime() - agora.getTime()) / 1000)
  return new ErroLimiteExcedido(segundos, 'Aguarde para pedir um novo código.', [
    { field: 'proximoEnvioEm', message: liberadoEm.toISOString() },
  ])
}

/** RF06: código de 6 dígitos que comprova a posse do e-mail cadastrado. */
@Injectable()
export class VerificacaoEmailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codigos: CodigoVerificacaoService,
    private readonly email: EmailService,
    private readonly limites: RateLimitService,
  ) {}

  /** Falha do provedor não propaga: o `EmailService` já registrou e o usuário pode reenviar. */
  async enviarCodigo(
    { id: usuarioId, atleticaId }: UsuarioNaAtletica,
    agora: Date = new Date(),
  ): Promise<RespostaEnvioVerificacao> {
    const usuario = await this.prisma.semEscopo.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { email: true, emailVerificado: true },
    })
    if (usuario.emailVerificado) throw erroEmailJaVerificado()

    const bloqueadoAte = await this.proximoEnvio(usuarioId, agora)
    if (bloqueadoAte) throw erroLimiteEnvio(bloqueadoAte, agora)
    await this.consumirEnvio(usuarioId, agora)

    const codigo = this.codigos.gerarCodigo()
    const expiraEm = new Date(agora.getTime() + VALIDADE_CODIGO_VERIFICACAO_MS)
    await this.prisma.semEscopo.$transaction([
      this.prisma.semEscopo.codigoVerificacao.updateMany({
        where: { usuarioId, tipo: TIPO_CODIGO, usadoEm: null },
        data: { usadoEm: agora },
      }),
      this.prisma.semEscopo.codigoVerificacao.create({
        data: {
          usuarioId,
          tipo: TIPO_CODIGO,
          codigoHash: this.codigos.hashCodigo(usuarioId, codigo),
          expiraEm,
          criadoEm: agora,
        },
      }),
    ])

    const atletica = await this.prisma.db.atletica.findUniqueOrThrow({
      where: { id: atleticaId },
      select: { nome: true, sigla: true, corPrimaria: true },
    })
    const conteudo = renderizar(verificacaoEmail, {
      atletica: { ...atletica, sigla: atletica.sigla ?? atletica.nome },
      codigo,
      validadeHoras: VALIDADE_CODIGO_VERIFICACAO_MS / HORA_MS,
    })
    await this.email.enviar({ para: usuario.email, ...conteudo }).catch(() => undefined)

    const proximoEnvioEm = (await this.proximoEnvio(usuarioId, agora)) ?? agora
    return {
      enviadoPara: mascararEmail(usuario.email),
      expiraEm: expiraEm.toISOString(),
      proximoEnvioEm: proximoEnvioEm.toISOString(),
    }
  }

  /** Idempotente: já verificado responde sucesso sem olhar o código. */
  async confirmar(
    usuarioId: string,
    { codigo }: VerificarEmailEntrada,
    agora: Date = new Date(),
  ): Promise<RespostaVerificarEmail> {
    const usuario = await this.prisma.semEscopo.usuario.findUniqueOrThrow({
      where: { id: usuarioId },
      select: { emailVerificado: true },
    })
    if (usuario.emailVerificado) return { emailVerificado: true }

    const [ultimo] = await this.prisma.semEscopo.codigoVerificacao.findMany({
      where: { usuarioId, tipo: TIPO_CODIGO },
      orderBy: { criadoEm: 'desc' },
      take: 1,
      select: { id: true, codigoHash: true, usadoEm: true, expiraEm: true },
    })
    // Sem código: nunca enviado ou já apagado pela `LimpezaDiariaJob`; nos dois casos, reenviar.
    if (!ultimo || ultimo.usadoEm || ultimo.expiraEm <= agora) throw erroCodigoExpirado()
    if (!this.codigos.codigoConfere(ultimo.codigoHash, usuarioId, codigo)) {
      await this.contarTentativa(ultimo.id, agora)
      throw erroCodigoInvalido()
    }

    await this.prisma.semEscopo.$transaction(async (tx) => {
      const { count } = await tx.codigoVerificacao.updateMany({
        where: { id: ultimo.id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      })
      if (count === 0) throw erroCodigoExpirado()
      await tx.usuario.update({ where: { id: usuarioId }, data: { emailVerificado: true } })
    })
    return { emailVerificado: true }
  }

  /** O mais tardio entre o limite por hora e o intervalo mínimo; `null` se já pode enviar. */
  private async proximoEnvio(usuarioId: string, agora: Date): Promise<Date | null> {
    const liberacoes = await Promise.all(
      LIMITES_ENVIO.map((limite) => this.limites.liberadoEm(TIPO_LIMITE, usuarioId, limite, agora)),
    )
    const instantes = liberacoes.filter((data) => data !== null).map((data) => data.getTime())
    return instantes.length > 0 ? new Date(Math.max(...instantes)) : null
  }

  /** O intervalo sob lock serializa envios simultâneos, o que também protege o limite por hora. */
  private async consumirEnvio(usuarioId: string, agora: Date): Promise<void> {
    try {
      await this.limites.consumir(TIPO_LIMITE, usuarioId, INTERVALO_ENVIO, agora)
    } catch (erro) {
      if (!(erro instanceof ErroLimiteExcedido)) throw erro
      const liberadoEm = new Date(agora.getTime() + erro.segundosParaNovaTentativa * 1000)
      throw erroLimiteEnvio(liberadoEm, agora)
    }
  }

  private contarTentativa(id: string, agora: Date): Promise<void> {
    return this.prisma.semEscopo.$transaction(async (tx) => {
      const [codigo] = await tx.codigoVerificacao.updateManyAndReturn({
        where: { id, usadoEm: null },
        data: { tentativas: { increment: 1 } },
        select: { tentativas: true },
      })
      if (codigo && codigo.tentativas >= MAXIMO_TENTATIVAS_VERIFICACAO) {
        await tx.codigoVerificacao.update({ where: { id }, data: { usadoEm: agora } })
      }
    })
  }
}
