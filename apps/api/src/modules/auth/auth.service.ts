import { randomBytes } from 'node:crypto'
import {
  Papel,
  TERMOS_VERSAO,
  type CadastroEntrada,
  type LoginEntrada,
  type RespostaSessao,
} from '@atletica/shared'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { AtleticaPadraoService } from '../atleticas/atletica-padrao.service'
import {
  erroContaDesativada,
  erroCredenciaisInvalidas,
  erroEmailJaCadastrado,
  erroTermosDesatualizados,
} from './erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from './rate-limit.service'
import { montarRespostaSessao, type UsuarioParaSessao } from './resposta-sessao'
import { SessaoService, type SessaoCriada } from './sessao.service'
import { TokenAcessoService } from './token-acesso.service'

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

const CAMPOS_USUARIO = { id: true, nome: true, email: true, fotoKey: true } as const

@Injectable()
export class AuthService implements OnModuleInit {
  /** Verificado quando o e-mail não existe, para o login levar o mesmo tempo (UC07 A1). */
  private hashFicticio?: Promise<string>

  constructor(
    private readonly prisma: PrismaService,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
    private readonly sessoes: SessaoService,
    private readonly tokens: TokenAcessoService,
    private readonly transacao: TransacaoService,
    private readonly eventos: EventosDominioService,
    private readonly contexto: ContextoAtletica,
    private readonly atleticaPadrao: AtleticaPadraoService,
  ) {}

  /** Gerado em segundo plano: não atrasa a subida da API. */
  onModuleInit(): void {
    void this.obterHashFicticio()
  }

  private obterHashFicticio(): Promise<string> {
    this.hashFicticio ??= this.senhas.hash(randomBytes(16).toString('hex'))
    return this.hashFicticio
  }

  async cadastrar(dados: CadastroEntrada, origem: OrigemRequisicao): Promise<RespostaSessao> {
    const chave = origem.ip ?? ''
    await this.limites.verificar(TipoTentativa.CADASTRO, chave, LIMITE_CADASTRO)
    await this.limites.registrar(TipoTentativa.CADASTRO, chave)

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
          return this.responder({ ...usuario, papel: Papel.ATLETA, atleticaId }, sessao)
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

  /** Algoritmo do épico #10 §7.2. */
  async entrar(dados: LoginEntrada, origem: OrigemRequisicao): Promise<RespostaSessao> {
    const chave = `${dados.email}|${origem.ip ?? ''}`
    await this.limites.verificar(TipoTentativa.LOGIN_FALHA, chave, LIMITE_LOGIN)

    const atleticaId = this.atleticaPadrao.id()
    const usuario = await this.prisma.semEscopo.usuario.findFirst({
      where: { email: dados.email, excluidoEm: null },
      select: {
        ...CAMPOS_USUARIO,
        senhaHash: true,
        ativo: true,
        vinculos: { where: { atleticaId }, select: { papel: true, ativo: true } },
      },
    })
    const vinculo = usuario?.vinculos[0]
    const senhaConfere = await this.senhas.verificar(
      usuario && vinculo ? usuario.senhaHash : await this.obterHashFicticio(),
      dados.senha,
    )
    if (!usuario || !vinculo || !senhaConfere) return this.falharLogin(chave)

    await this.limites.limpar(TipoTentativa.LOGIN_FALHA, chave)
    if (!usuario.ativo || !vinculo.ativo) {
      throw erroContaDesativada((await this.atleticaPadrao.obter()).nome)
    }

    const novoHash = this.senhas.precisaRefazerHash(usuario.senhaHash)
      ? await this.senhas.hash(dados.senha)
      : undefined
    return this.transacao.executar(async (tx) => {
      if (novoHash) {
        await tx.usuario.update({ where: { id: usuario.id }, data: { senhaHash: novoHash } })
      }
      const sessao = await this.sessoes.criar(tx, { usuarioId: usuario.id, atleticaId, ...origem })
      return this.responder({ ...usuario, papel: vinculo.papel, atleticaId }, sessao)
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

  private responder(usuario: UsuarioParaSessao, sessao: SessaoCriada): RespostaSessao {
    const acesso = this.tokens.assinar({
      sub: usuario.id,
      atl: usuario.atleticaId,
      sid: sessao.sessaoId,
    })
    return montarRespostaSessao(usuario, sessao, acesso)
  }
}
