import {
  MENSAGEM_RECUPERACAO_ENVIADA,
  type EsqueciSenhaEntrada,
  type RedefinirSenhaEntrada,
  type RespostaEsqueciSenha,
  type RespostaVerificarCodigo,
  type VerificarCodigoEntrada,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { ErroLimiteExcedido } from '../../common/erros/erro-negocio'
import { CodigoVerificacaoService } from '../../infra/email/codigo-verificacao'
import { EmailService } from '../../infra/email/email.service'
import { renderizar } from '../../infra/email/templates/base'
import { recuperarSenha } from '../../infra/email/templates/recuperar-senha'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { AtleticaPadraoService } from '../atleticas/atletica-padrao.service'
import { chaveIp, prefixoChaveLogin, type OrigemRequisicao } from './auth.service'
import { erroCodigoInvalido } from './erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from './rate-limit.service'
import { SessaoService } from './sessao.service'

const MINUTO_MS = 60_000
const HORA_MS = 60 * MINUTO_MS

export const VALIDADE_CODIGO_MS = 15 * MINUTO_MS
/** Na 5ª tentativa errada o código é invalidado (épico #11 §3.7). */
export const MAXIMO_TENTATIVAS_CODIGO = 5
/** UC09 A1: contado por e-mail, exista ou não a conta. */
export const LIMITE_ENVIO_EMAIL: LimiteTentativas = { maximo: 3, janelaMs: HORA_MS }
export const LIMITE_ENVIO_IP: LimiteTentativas = { maximo: 10, janelaMs: HORA_MS }
/** Verificações erradas por IP (épico #11 §10). */
export const LIMITE_CODIGO_IP: LimiteTentativas = { maximo: 30, janelaMs: HORA_MS }

const TIPO_CODIGO = 'RECUPERAR_SENHA'

interface CodigoValido {
  id: string
  usuarioId: string
}

function erroLimiteEnvios(segundos: number): ErroLimiteExcedido {
  const minutos = Math.ceil(segundos / 60)
  return new ErroLimiteExcedido(
    segundos,
    `Limite de ${LIMITE_ENVIO_EMAIL.maximo} envios por hora atingido. Tente novamente em ${minutos} min.`,
  )
}

/** UC09: código de 6 dígitos por e-mail, sem revelar quais e-mails existem (épico #11 §7). */
@Injectable()
export class RecuperacaoSenhaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly codigos: CodigoVerificacaoService,
    private readonly email: EmailService,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
    private readonly sessoes: SessaoService,
    private readonly transacao: TransacaoService,
    private readonly eventos: EventosDominioService,
    private readonly atleticaPadrao: AtleticaPadraoService,
  ) {}

  async solicitar(
    { email }: EsqueciSenhaEntrada,
    origem: OrigemRequisicao,
  ): Promise<RespostaEsqueciSenha> {
    await this.limites.consumir(
      TipoTentativa.RECUPERACAO_ENVIO,
      chaveIp(origem.ip),
      LIMITE_ENVIO_IP,
    )
    await this.consumirEnvioDoEmail(email)

    const usuario = await this.contaRecuperavel(email)
    if (usuario) {
      const codigo = this.codigos.gerarCodigo()
      await this.prisma.semEscopo.codigoVerificacao.create({
        data: {
          usuarioId: usuario.id,
          tipo: TIPO_CODIGO,
          codigoHash: this.codigos.hashCodigo(usuario.id, codigo),
          expiraEm: new Date(Date.now() + VALIDADE_CODIGO_MS),
        },
      })
      const { nome, sigla, corPrimaria } = await this.atleticaPadrao.obter()
      const conteudo = renderizar(recuperarSenha, {
        atletica: { nome, sigla: sigla ?? nome, corPrimaria },
        codigo,
        validadeMinutos: VALIDADE_CODIGO_MS / MINUTO_MS,
      })
      // Sem aguardar: a latência não pode revelar a existência da conta (o erro já é logado).
      void this.email.enviar({ para: email, ...conteudo }).catch(() => undefined)
    }
    return { message: MENSAGEM_RECUPERACAO_ENVIADA }
  }

  /** Não consome o código. */
  async verificarCodigo(
    dados: VerificarCodigoEntrada,
    origem: OrigemRequisicao,
  ): Promise<RespostaVerificarCodigo> {
    await this.validarCodigo(dados, origem)
    return { valido: true }
  }

  /** `novaSenha` já foi validada pelo pipe: senha fraca não gasta tentativa do código. */
  async redefinir(
    { email, codigo, novaSenha }: RedefinirSenhaEntrada,
    origem: OrigemRequisicao,
  ): Promise<void> {
    const { id, usuarioId } = await this.validarCodigo({ email, codigo }, origem)
    const senhaHash = await this.senhas.hash(novaSenha)

    await this.transacao.executar(async (tx) => {
      const agora = new Date()
      const { count } = await tx.codigoVerificacao.updateMany({
        where: { id, usadoEm: null, expiraEm: { gt: agora } },
        data: { usadoEm: agora },
      })
      if (count === 0) throw erroCodigoInvalido()

      await tx.usuario.update({ where: { id: usuarioId }, data: { senhaHash } })
      const sessaoIds = await this.sessoes.revogarTodas(tx, usuarioId, 'RECUPERACAO_SENHA')
      await this.limites.limparPorPrefixo(TipoTentativa.LOGIN_FALHA, prefixoChaveLogin(email), tx)
      if (sessaoIds.length > 0) {
        this.eventos.emitirAposCommit('usuario.sessaoEncerrada', {
          usuarioId,
          sessaoIds,
          motivo: 'RECUPERACAO_SENHA',
          autorId: null,
        })
      }
    })
  }

  private async consumirEnvioDoEmail(email: string): Promise<void> {
    try {
      await this.limites.consumir(TipoTentativa.RECUPERACAO_ENVIO, email, LIMITE_ENVIO_EMAIL)
    } catch (erro) {
      if (erro instanceof ErroLimiteExcedido) throw erroLimiteEnvios(erro.segundosParaNovaTentativa)
      throw erro
    }
  }

  /** Conta ativa e não excluída, com vínculo ativo na atlética padrão (RN36). */
  private contaRecuperavel(email: string) {
    return this.prisma.semEscopo.usuario.findFirst({
      where: {
        email,
        excluidoEm: null,
        ativo: true,
        vinculos: { some: { atleticaId: this.atleticaPadrao.id(), ativo: true } },
      },
      select: { id: true },
    })
  }

  private async validarCodigo(
    { email, codigo }: VerificarCodigoEntrada,
    origem: OrigemRequisicao,
  ): Promise<CodigoValido> {
    const chave = chaveIp(origem.ip)
    await this.limites.verificar(TipoTentativa.CODIGO_TENTATIVA, chave, LIMITE_CODIGO_IP)

    const ativo = await this.codigoAtivo(email)
    if (ativo && this.codigos.codigoConfere(ativo.codigoHash, ativo.usuarioId, codigo)) {
      return { id: ativo.id, usuarioId: ativo.usuarioId }
    }
    if (ativo) await this.contarTentativa(ativo.id)
    await this.limites.registrar(TipoTentativa.CODIGO_TENTATIVA, chave)
    throw erroCodigoInvalido()
  }

  /** Só o código mais recente vale: um novo invalida os anteriores mesmo que não usados. */
  private async codigoAtivo(email: string) {
    const [ultimo] = await this.prisma.semEscopo.codigoVerificacao.findMany({
      where: { tipo: TIPO_CODIGO, usuario: { email, excluidoEm: null } },
      orderBy: { criadoEm: 'desc' },
      take: 1,
      select: { id: true, usuarioId: true, codigoHash: true, usadoEm: true, expiraEm: true },
    })
    if (!ultimo || ultimo.usadoEm || ultimo.expiraEm <= new Date()) return null
    return ultimo
  }

  private async contarTentativa(id: string): Promise<void> {
    const db = this.prisma.semEscopo
    const [codigo] = await db.codigoVerificacao.updateManyAndReturn({
      where: { id, usadoEm: null },
      data: { tentativas: { increment: 1 } },
      select: { tentativas: true },
    })
    if (codigo && codigo.tentativas >= MAXIMO_TENTATIVAS_CODIGO) {
      await db.codigoVerificacao.update({ where: { id }, data: { expiraEm: new Date() } })
    }
  }
}
