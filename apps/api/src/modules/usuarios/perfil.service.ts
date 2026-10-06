import {
  FinalidadeUpload,
  type AlterarSenha,
  type AtualizarPerfil,
  type FotoAtualizada,
  type Papel,
  type Perfil,
} from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { MINUTO_MS } from '../../common/tempo'
import { aposCommit, TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import { PrismaService } from '../../infra/prisma/prisma.service'
import { SenhaService } from '../../infra/senha/senha.service'
import { erroNaoAutenticado } from '../auth/erros'
import { RateLimitService, TipoTentativa, type LimiteTentativas } from '../auth/rate-limit.service'
import { SessaoService } from '../auth/sessao.service'
import type { UsuarioAutenticado, UsuarioNaAtletica } from '../auth/tipos'
import { UploadsService } from '../uploads/uploads.service'
import { erroSenhaIgualAtual, erroSenhaIncorreta } from './erros'

/** Mesmo contador da exclusão de conta (#12): chave = `usuarioId`. */
export const LIMITE_SENHA_ATUAL: LimiteTentativas = { maximo: 5, janelaMs: 15 * MINUTO_MS }

export interface DadosPerfil {
  id: string
  nome: string
  email: string
  fotoKey: string | null
  emailVerificado: boolean
  criadoEm: Date
  vinculos: { papel: Papel; atletica: { id: string; nome: string; sigla: string | null } }[]
  membrosTime: {
    entradaEm: Date
    time: {
      id: string
      nome: string
      capitaoId: string | null
      modalidade: { id: string; nome: string; icone: string }
    }
  }[]
  aceitesTermos: { versao: string; aceitoEm: Date }[]
}

/** Vínculos encerrados e times inativos já vêm filtrados da consulta. */
function camposPerfil(atleticaId: string) {
  return {
    id: true,
    nome: true,
    email: true,
    fotoKey: true,
    emailVerificado: true,
    criadoEm: true,
    vinculos: {
      where: { atleticaId },
      select: { papel: true, atletica: { select: { id: true, nome: true, sigla: true } } },
    },
    membrosTime: {
      where: { atleticaId, saidaEm: null, time: { ativo: true } },
      orderBy: { time: { nome: 'asc' } },
      select: {
        entradaEm: true,
        time: {
          select: {
            id: true,
            nome: true,
            capitaoId: true,
            modalidade: { select: { id: true, nome: true, icone: true } },
          },
        },
      },
    },
    aceitesTermos: {
      orderBy: { aceitoEm: 'desc' },
      take: 1,
      select: { versao: true, aceitoEm: true },
    },
  } as const
}

export function montarPerfil(dados: DadosPerfil, fotoUrl: string | null): Perfil {
  const [vinculo] = dados.vinculos
  if (!vinculo) throw erroNaoAutenticado()
  const [termos] = dados.aceitesTermos
  return {
    id: dados.id,
    nome: dados.nome,
    email: dados.email,
    fotoUrl,
    emailVerificado: dados.emailVerificado,
    papel: vinculo.papel,
    atletica: vinculo.atletica,
    times: dados.membrosTime.map(({ entradaEm, time: { capitaoId, ...time } }) => ({
      ...time,
      capitao: capitaoId === dados.id,
      entradaEm: entradaEm.toISOString(),
    })),
    termosAceitos: termos
      ? { versao: termos.versao, aceitoEm: termos.aceitoEm.toISOString() }
      : null,
    criadoEm: dados.criadoEm.toISOString(),
  }
}

/** Perfil do usuário autenticado: `/me`, `/me/foto` e `/me/senha` (UC10, UC11, issue #13). */
@Injectable()
export class PerfilService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transacao: TransacaoService,
    private readonly uploads: UploadsService,
    private readonly senhas: SenhaService,
    private readonly limites: RateLimitService,
    private readonly sessoes: SessaoService,
    private readonly eventos: EventosDominioService,
  ) {}

  /** Uma consulta só (RNF03); o papel é o do vínculo atual, não o do login. */
  async obter({ id, atleticaId }: UsuarioNaAtletica): Promise<Perfil> {
    const dados = await this.prisma.db.usuario.findUnique({
      where: { id },
      select: camposPerfil(atleticaId),
    })
    if (!dados) throw erroNaoAutenticado()
    return montarPerfil(dados, this.uploads.urlPublica(dados.fotoKey))
  }

  async atualizar(solicitante: UsuarioNaAtletica, { nome }: AtualizarPerfil): Promise<Perfil> {
    await this.prisma.db.usuario.update({ where: { id: solicitante.id }, data: { nome } })
    return this.obter(solicitante)
  }

  /** A chave só é validada quando muda; a foto anterior sai do R2 depois do commit. */
  async atualizarFoto(
    { id, atleticaId }: UsuarioNaAtletica,
    fotoKey: string,
  ): Promise<FotoAtualizada> {
    const anterior = await this.fotoKeyAtual(id)
    if (anterior !== fotoKey) {
      await this.uploads.validarKey({
        key: fotoKey,
        finalidade: FinalidadeUpload.PERFIL,
        usuarioId: id,
        atleticaId,
      })
      await this.trocarFoto(id, anterior, fotoKey)
    }
    return { fotoUrl: this.uploads.urlPublica(fotoKey) }
  }

  /** Idempotente: sem foto, nada muda. */
  async removerFoto({ id }: UsuarioNaAtletica): Promise<void> {
    const anterior = await this.fotoKeyAtual(id)
    if (anterior) await this.trocarFoto(id, anterior, null)
  }

  /** Revoga as outras sessões; o aparelho atual continua logado. */
  async alterarSenha(
    { id, sessaoId }: Pick<UsuarioAutenticado, 'id' | 'sessaoId'>,
    { senhaAtual, novaSenha }: AlterarSenha,
  ): Promise<void> {
    await this.limites.verificar(TipoTentativa.SENHA_CONFIRMACAO_FALHA, id, LIMITE_SENHA_ATUAL)
    const usuario = await this.prisma.db.usuario.findUnique({
      where: { id },
      select: { senhaHash: true },
    })
    if (!usuario) throw erroNaoAutenticado()
    if (!(await this.senhas.verificar(usuario.senhaHash, senhaAtual))) {
      await this.limites.registrar(TipoTentativa.SENHA_CONFIRMACAO_FALHA, id)
      throw erroSenhaIncorreta()
    }
    if (novaSenha === senhaAtual) throw erroSenhaIgualAtual()

    const senhaHash = await this.senhas.hash(novaSenha)
    await this.transacao.executar(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { senhaHash } })
      const sessaoIds = await this.sessoes.revogarTodas(tx, id, 'TROCA_SENHA', {
        exceto: sessaoId,
      })
      if (sessaoIds.length === 0) return
      this.eventos.emitirAposCommit('usuario.sessaoEncerrada', {
        usuarioId: id,
        sessaoIds,
        motivo: 'TROCA_SENHA',
        autorId: id,
      })
    })
  }

  private async fotoKeyAtual(id: string): Promise<string | null> {
    const usuario = await this.prisma.db.usuario.findUnique({
      where: { id },
      select: { fotoKey: true },
    })
    if (!usuario) throw erroNaoAutenticado()
    return usuario.fotoKey
  }

  private async trocarFoto(id: string, anterior: string | null, fotoKey: string | null) {
    await this.transacao.executar(async (tx) => {
      await tx.usuario.update({ where: { id }, data: { fotoKey } })
      if (anterior) aposCommit(() => this.uploads.remover(anterior))
    })
  }
}
