import { Papel, StatusSolicitacao } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { ContextoAtletica } from '../../infra/contexto/contexto-atletica.service'
import { aposCommit, TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService, type TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { AuditoriaService } from '../auditoria/auditoria.service'
import { prefixoChaveLogin } from '../auth/chaves-limite'
import { erroNaoAutenticado } from '../auth/erros'
import { RateLimitService, TipoTentativa } from '../auth/rate-limit.service'
import { SessaoService } from '../auth/sessao.service'
import { ElencoService, MotivoSaida } from '../times/elenco.service'
import { UploadsService } from '../uploads/uploads.service'
import { erroSenhaIncorreta, MENSAGEM_ULTIMO_ADMINISTRADOR_EXCLUSAO } from './erros'
import { LIMITE_SENHA_ATUAL } from './perfil.service'
import { bloquearPapeis, garantirNaoUltimoAdministrador } from './regras-papel'

export const NOME_ANONIMO = 'Usuário excluído'
const SENHA_INCORRETA = 'Senha incorreta.'
/** Não é um hash Argon2id: `SenhaService.verificar` nunca confere. */
export const SENHA_HASH_INVALIDO = '!'

/** Único por conta e não entregável (TLD `.invalid`, RFC 2606); libera o e-mail original. */
export function emailAnonimo(usuarioId: string): string {
  return `excluido+${usuarioId}@anonimo.invalid`
}

interface Vinculo {
  atleticaId: string
  papel: Papel
  ativo: boolean
}

const ehAdministradorAtivo = ({ papel, ativo }: Vinculo) => ativo && papel === Papel.ADMINISTRADOR

/** Exclusão da conta pelo próprio usuário com anonimização (UC13, RN33, issue #12). */
@Injectable()
export class ContaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly contexto: ContextoAtletica,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
    private readonly sessoes: SessaoService,
    private readonly elenco: ElencoService,
    private readonly auditoria: AuditoriaService,
    private readonly uploads: UploadsService,
    private readonly eventos: EventosDominioService,
  ) {}

  async excluir(usuarioId: string, senha: string): Promise<void> {
    await this.limites.verificar(
      TipoTentativa.SENHA_CONFIRMACAO_FALHA,
      usuarioId,
      LIMITE_SENHA_ATUAL,
    )
    const credencial = await this.prisma.semEscopo.usuario.findUnique({
      where: { id: usuarioId },
      select: { senhaHash: true },
    })
    if (!credencial) throw erroNaoAutenticado()
    if (!(await this.senhas.verificar(credencial.senhaHash, senha))) {
      await this.limites.registrar(TipoTentativa.SENHA_CONFIRMACAO_FALHA, usuarioId)
      throw erroSenhaIncorreta('senha', SENHA_INCORRETA)
    }

    await this.transacao.executar(async (tx) => {
      const conta = await this.travarConta(tx, usuarioId)
      for (const { atleticaId } of conta.vinculos.filter(ehAdministradorAtivo)) {
        await this.contexto.executarComAtletica(atleticaId, async () => {
          await bloquearPapeis(tx, atleticaId)
          await garantirNaoUltimoAdministrador(
            tx,
            atleticaId,
            usuarioId,
            MENSAGEM_ULTIMO_ADMINISTRADOR_EXCLUSAO,
          )
        })
      }
      for (const { atleticaId, papel } of conta.vinculos) {
        await this.contexto.executarComAtletica(atleticaId, () =>
          this.sairDaAtletica(tx, usuarioId, papel),
        )
      }
      await this.anonimizar(tx, usuarioId, conta.email)

      const sessaoIds = await this.sessoes.revogarTodas(tx, usuarioId, 'CONTA_EXCLUIDA')
      if (sessaoIds.length > 0) {
        this.eventos.emitirAposCommit('usuario.sessaoEncerrada', {
          usuarioId,
          sessaoIds,
          motivo: 'CONTA_EXCLUIDA',
          autorId: usuarioId,
        })
      }
      const { fotoKey } = conta
      if (fotoKey) aposCommit(() => this.uploads.remover(fotoKey))
    })
  }

  /**
   * A conta é global: SQL direto lê os vínculos de todas as atléticas, já dentro da transação.
   * O `FOR UPDATE` serializa com outra exclusão ou troca de foto da mesma conta.
   */
  private async travarConta(tx: TransacaoComEscopo, usuarioId: string) {
    const [usuario] = await tx.$queryRaw<{ email: string; fotoKey: string | null }[]>`
      SELECT "email", "fotoKey" FROM "Usuario" WHERE "id" = ${usuarioId}::uuid FOR UPDATE`
    if (!usuario) throw erroNaoAutenticado()
    const vinculos = await tx.$queryRaw<Vinculo[]>`
      SELECT "atleticaId", "papel", "ativo" FROM "VinculoAtletica"
      WHERE "usuarioId" = ${usuarioId}::uuid ORDER BY "atleticaId"`
    return { ...usuario, vinculos }
  }

  /** Roda no contexto da atlética; times em ordem de id para travar sempre na mesma ordem. */
  private async sairDaAtletica(tx: TransacaoComEscopo, usuarioId: string, papel: Papel) {
    const membros = await tx.membroTime.findMany({
      where: { usuarioId, saidaEm: null },
      orderBy: { timeId: 'asc' },
      select: { timeId: true },
    })
    const timeIds = membros.map(({ timeId }) => timeId)
    for (const timeId of timeIds) {
      await this.elenco.encerrarVinculo(tx, {
        timeId,
        usuarioId,
        motivo: MotivoSaida.EXCLUSAO_CONTA,
        executorId: usuarioId,
      })
    }
    await tx.solicitacaoEntrada.updateMany({
      where: { usuarioId, status: StatusSolicitacao.PENDENTE },
      data: { status: StatusSolicitacao.CANCELADA, canceladaEm: new Date() },
    })
    await tx.vinculoAtletica.updateMany({
      where: { usuarioId },
      data: { ativo: false, papel: Papel.ATLETA },
    })
    await this.auditoria.registrar(tx, {
      entidade: 'Usuario',
      acao: 'CONTA_EXCLUIDA',
      entidadeId: usuarioId,
      dados: { antes: { papel }, depois: null, contexto: { timeIds } },
    })
  }

  /** Modelos da conta, sem escopo por atlética. Ficam `AceiteTermos`, participações e autorias. */
  private async anonimizar(tx: TransacaoComEscopo, usuarioId: string, email: string) {
    await tx.usuario.update({
      where: { id: usuarioId },
      data: {
        nome: NOME_ANONIMO,
        email: emailAnonimo(usuarioId),
        senhaHash: SENHA_HASH_INVALIDO,
        fotoKey: null,
        emailVerificado: false,
        ativo: false,
        excluidoEm: new Date(),
      },
    })
    await tx.codigoVerificacao.deleteMany({ where: { usuarioId } })
    await tx.preferenciaNotificacao.deleteMany({ where: { usuarioId } })
    await tx.dispositivoPush.deleteMany({ where: { usuarioId } })
    await this.limites.limparPorPrefixo(TipoTentativa.LOGIN_FALHA, prefixoChaveLogin(email), tx)
    await tx.tentativaAcesso.deleteMany({
      where: { tipo: TipoTentativa.RECUPERACAO_ENVIO, chave: email },
    })
  }
}
