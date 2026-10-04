import { randomBytes } from 'node:crypto'
import {
  Papel,
  TERMOS_VERSAO,
  type CadastroEntrada,
  type LoginEntrada,
  type RespostaSessao,
} from '@atletica/shared'
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { ErroNegocio } from '../../common/erros/erro-negocio'
import { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import type { MotivoRevogacao } from '../../infra/eventos/eventos-dominio'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { AtleticaPadraoService } from '../atleticas/atletica-padrao.service'
import {
  erroContaDesativada,
  erroCredenciaisInvalidas,
  erroEmailJaCadastrado,
  erroRefreshInvalido,
  erroRefreshJaRotacionado,
  erroSessaoRevogada,
  erroTermosDesatualizados,
} from './erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from './rate-limit.service'
import { RespostaSessaoService } from './resposta-sessao.service'
import { SessaoService, type SessaoDoUsuario } from './sessao.service'

const MINUTO_MS = 60_000

/** RNF06: 5 falhas em 15 min por e-mail + IP bloqueiam por 15 min. */
export const LIMITE_LOGIN: LimiteTentativas = {
  maximo: 5,
  janelaMs: 15 * MINUTO_MS,
  bloqueioMs: 15 * MINUTO_MS,
}
/** Mitiga a enumeração de e-mails pelo cadastro (épico #10 §10). */
export const LIMITE_CADASTRO: LimiteTentativas = { maximo: 10, janelaMs: 60 * MINUTO_MS }

export interface OrigemRequisicao {
  ip?: string
  userAgent?: string
}

const SEM_IP = 'sem-ip'

export function chaveCadastro(ip: string | undefined): string {
  return ip ?? SEM_IP
}

export function chaveLogin(email: string, ip: string | undefined): string {
  return `${email}|${ip ?? SEM_IP}`
}

const CAMPOS_USUARIO = { id: true, nome: true, email: true, fotoKey: true } as const

function camposConta(atleticaId: string) {
  return {
    ...CAMPOS_USUARIO,
    ativo: true,
    vinculos: { where: { atleticaId }, select: { papel: true, ativo: true } },
  } as const
}

function contaAtiva(usuario: { ativo: boolean }, vinculo: { ativo: boolean }): boolean {
  return usuario.ativo && vinculo.ativo
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name)
  /** Verificado quando o e-mail não existe, para o login levar o mesmo tempo (UC07 A1). */
  private hashFicticio?: Promise<string>

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
    private readonly sessoes: SessaoService,
    private readonly respostas: RespostaSessaoService,
    private readonly transacao: TransacaoService,
    private readonly eventos: EventosDominioService,
    private readonly contexto: ContextoAtletica,
    private readonly atleticaPadrao: AtleticaPadraoService,
  ) {}

  onModuleInit(): void {
    void this.obterHashFicticio()
  }

  private obterHashFicticio(): Promise<string> {
    this.hashFicticio ??= this.senhas.hash(randomBytes(16).toString('hex'))
    return this.hashFicticio
  }

  async cadastrar(dados: CadastroEntrada, origem: OrigemRequisicao): Promise<RespostaSessao> {
    await this.limites.consumir(TipoTentativa.CADASTRO, chaveCadastro(origem.ip), LIMITE_CADASTRO)

    if (dados.versaoTermos !== TERMOS_VERSAO) throw erroTermosDesatualizados()
    const existente = await this.prisma.semEscopo.usuario.findUnique({
      where: { email: dados.email },
      select: { id: true },
    })
    if (existente) throw erroEmailJaCadastrado()

    const senhaHash = await this.senhas.hash(dados.senha)
    const atleticaId = this.atleticaPadrao.id()
    try {
      return await this.contexto.executarComAtletica(atleticaId, () =>
        this.transacao.executar(async (tx) => {
          const usuario = await tx.usuario.create({
            data: { nome: dados.nome, email: dados.email, senhaHash },
            select: CAMPOS_USUARIO,
          })
          const usuarioId = usuario.id
          await tx.vinculoAtletica.create({ data: { usuarioId, atleticaId, papel: Papel.ATLETA } })
          await tx.preferenciaNotificacao.create({ data: { usuarioId } })
          await tx.aceiteTermos.create({
            data: { usuarioId, versao: dados.versaoTermos, ip: origem.ip },
          })
          const sessao = await this.sessoes.criar(tx, { usuarioId, atleticaId, ...origem })
          this.eventos.emitirAposCommit('usuario.cadastrado', {
            usuarioId,
            atleticaId,
            autorId: usuarioId,
          })
          return this.respostas.montar({ ...usuario, papel: Papel.ATLETA, atleticaId }, sessao)
        }),
      )
    } catch (erro) {
      // Corrida com outro cadastro do mesmo e-mail: a constraint única decide.
      if (erro instanceof PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw erroEmailJaCadastrado()
      }
      throw erro
    }
  }

  async entrar(dados: LoginEntrada, origem: OrigemRequisicao): Promise<RespostaSessao> {
    const chave = chaveLogin(dados.email, origem.ip)
    await this.limites.verificar(TipoTentativa.LOGIN_FALHA, chave, LIMITE_LOGIN)

    const atleticaId = this.atleticaPadrao.id()
    const usuario = await this.prisma.semEscopo.usuario.findFirst({
      where: { email: dados.email, excluidoEm: null },
      select: { ...camposConta(atleticaId), senhaHash: true },
    })
    const vinculo = usuario?.vinculos[0]
    const senhaConfere = await this.senhas.verificar(
      usuario && vinculo ? usuario.senhaHash : await this.obterHashFicticio(),
      dados.senha,
    )
    if (!usuario || !vinculo || !senhaConfere) return this.falharLogin(chave)

    await this.limites.limpar(TipoTentativa.LOGIN_FALHA, chave)
    if (!contaAtiva(usuario, vinculo)) {
      const { nome } = await this.atleticaPadrao.obter()
      throw erroContaDesativada(nome)
    }

    const novoHash = this.senhas.precisaRefazerHash(usuario.senhaHash)
      ? await this.senhas.hash(dados.senha)
      : undefined
    return this.transacao.executar(async (tx) => {
      if (novoHash) {
        await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash: novoHash } })
      }
      const sessao = await this.sessoes.criar(tx, { usuarioId: usuario.id, atleticaId, ...origem })
      return this.respostas.montar({ ...usuario, papel: vinculo.papel, atleticaId }, sessao)
    })
  }

  /** As revogações (reuso, conta desativada ou excluída) são gravadas antes de responder `401`. */
  async renovar(refreshToken: string): Promise<RespostaSessao> {
    const resultado = await this.transacao.executar((tx) =>
      this.renovarNaTransacao(tx, refreshToken),
    )
    if (resultado instanceof ErroNegocio) throw resultado
    return resultado
  }

  /** Idempotente: só revoga e emite o evento se o token pertence a uma sessão ativa. */
  async sair(refreshToken: string): Promise<void> {
    await this.transacao.executar(async (tx) => {
      const sessao = await this.sessoes.revogarPorToken(tx, refreshToken, 'LOGOUT')
      if (sessao) this.emitirSessaoEncerrada(sessao, 'LOGOUT', sessao.usuarioId)
    })
  }

  private async renovarNaTransacao(
    tx: TransacaoComEscopo,
    refreshToken: string,
  ): Promise<RespostaSessao | ErroNegocio> {
    const rotacao = await this.sessoes.rotacionar(tx, refreshToken)
    switch (rotacao.tipo) {
      case 'INVALIDO':
        return erroRefreshInvalido()
      case 'REVOGADA':
        return erroSessaoRevogada()
      case 'JA_ROTACIONADO':
        return erroRefreshJaRotacionado()
      case 'REUSO':
        this.logger.warn(
          { sessaoId: rotacao.sessaoId, usuarioId: rotacao.usuarioId },
          'Reuso de refresh token: sessão revogada',
        )
        this.emitirSessaoEncerrada(rotacao, 'REUSO_REFRESH', null)
        return erroSessaoRevogada()
    }

    const { atleticaId } = rotacao
    const usuario = await tx.usuario.findUnique({
      where: { id: rotacao.usuarioId },
      select: { ...camposConta(atleticaId), excluidoEm: true },
    })
    const vinculo = usuario?.vinculos[0]
    // Conta excluída é tratada como inexistente (épico #10 §3.3).
    if (!usuario || usuario.excluidoEm) {
      return this.revogarNaRenovacao(tx, rotacao, 'CONTA_EXCLUIDA', erroRefreshInvalido())
    }
    if (!vinculo || !contaAtiva(usuario, vinculo)) {
      return this.revogarNaRenovacao(tx, rotacao, 'CONTA_DESATIVADA', erroContaDesativada())
    }
    return this.respostas.montar({ ...usuario, papel: vinculo.papel, atleticaId }, rotacao)
  }

  private async revogarNaRenovacao(
    tx: TransacaoComEscopo,
    sessao: SessaoDoUsuario,
    motivo: MotivoRevogacao,
    erro: ErroNegocio,
  ): Promise<ErroNegocio> {
    await this.sessoes.revogar(tx, sessao.sessaoId, motivo)
    this.emitirSessaoEncerrada(sessao, motivo, null)
    return erro
  }

  private emitirSessaoEncerrada(
    { sessaoId, usuarioId }: SessaoDoUsuario,
    motivo: MotivoRevogacao,
    autorId: string | null,
  ): void {
    this.eventos.emitirAposCommit('usuario.sessaoEncerrada', {
      usuarioId,
      sessaoIds: [sessaoId],
      motivo,
      autorId,
    })
  }

  /** A 5ª falha na janela já responde `429`; a 4ª avisa que é a última tentativa. */
  private async falharLogin(chave: string): Promise<never> {
    const agora = new Date()
    await this.limites.registrar(TipoTentativa.LOGIN_FALHA, chave, agora)
    const restantes = await this.limites.verificar(
      TipoTentativa.LOGIN_FALHA,
      chave,
      LIMITE_LOGIN,
      agora,
    )
    throw erroCredenciaisInvalidas(restantes === 1)
  }
}
