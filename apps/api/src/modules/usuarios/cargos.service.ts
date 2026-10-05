import { nivelDoPapel, Papel, type AlterarPapel, type PapelAlterado } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import {
  erroConflitoConcorrente,
  erroSubstituicaoNecessaria,
  erroUsuarioDesativado,
  erroUsuarioExcluido,
  erroUsuarioNaoEncontrado,
} from './erros'
import {
  bloquearPapeis,
  bloquearVinculo,
  garantirNaoUltimoAdministrador,
  papelDoSolicitante,
  type SolicitanteNaAtletica,
} from './regras-papel'

const CARGOS_UNICOS: ReadonlySet<Papel> = new Set([Papel.PRESIDENTE, Papel.VICE_PRESIDENTE])

interface Ocupante {
  vinculoId: string
  usuarioId: string
  nome: string
}

/** Concessão e revogação de cargos pelo Administrador (UC24, issue #28). */
@Injectable()
export class CargosService {
  constructor(
    private readonly transacao: TransacaoService,
    private readonly auditoria: AuditoriaService,
    private readonly eventos: EventosDominioService,
  ) {}

  /** O índice único parcial de Presidente/Vice é a defesa final contra a corrida (P2002). */
  async alterarPapel(
    id: string,
    { papel, confirmarSubstituicao = false }: AlterarPapel,
    solicitante: SolicitanteNaAtletica,
  ): Promise<PapelAlterado> {
    try {
      return await this.transacao.executar((tx) =>
        this.aplicar(tx, id, papel, confirmarSubstituicao, solicitante),
      )
    } catch (erro) {
      if (erro instanceof PrismaClientKnownRequestError && erro.code === 'P2002') {
        throw erroConflitoConcorrente()
      }
      throw erro
    }
  }

  private async aplicar(
    tx: TransacaoComEscopo,
    id: string,
    papel: Papel,
    confirmarSubstituicao: boolean,
    solicitante: SolicitanteNaAtletica,
  ): Promise<PapelAlterado> {
    const { atleticaId } = solicitante
    await bloquearPapeis(tx, atleticaId)
    const alvo = await bloquearVinculo(tx, id, atleticaId)
    if (!alvo) throw erroUsuarioNaoEncontrado()
    await papelDoSolicitante(tx, solicitante.id, Papel.ADMINISTRADOR)
    if (alvo.excluido) throw erroUsuarioExcluido()

    const usuario = { id, papelAnterior: alvo.papel, papel }
    if (papel === alvo.papel) return { alterado: false, usuario, substituido: null }

    if (!alvo.ativo && nivelDoPapel(papel) > nivelDoPapel(Papel.ATLETA)) {
      throw erroUsuarioDesativado()
    }
    if (alvo.papel === Papel.ADMINISTRADOR) {
      await garantirNaoUltimoAdministrador(tx, atleticaId, id)
    }

    const ocupante = CARGOS_UNICOS.has(papel) ? await this.ocupante(tx, papel, id) : null
    if (ocupante && !confirmarSubstituicao) throw erroSubstituicaoNecessaria(ocupante.nome, papel)

    const entradas: EntradaAuditoria[] = []
    if (ocupante) {
      await tx.vinculoAtletica.update({
        where: { id: ocupante.vinculoId },
        data: { papel: Papel.DIRETOR },
      })
      entradas.push(entradaCargo(ocupante.usuarioId, papel, Papel.DIRETOR, { substituidoPor: id }))
    }
    await tx.vinculoAtletica.update({ where: { id: alvo.id }, data: { papel } })
    entradas.push(entradaCargo(id, alvo.papel, papel))
    await this.auditoria.registrarVarios(tx, entradas)

    if (ocupante) this.emitir(solicitante, ocupante.usuarioId, papel, Papel.DIRETOR)
    this.emitir(solicitante, id, alvo.papel, papel)

    return {
      alterado: true,
      usuario,
      substituido: ocupante && {
        id: ocupante.usuarioId,
        nome: ocupante.nome,
        papelAnterior: papel,
        papel: Papel.DIRETOR,
      },
    }
  }

  private async ocupante(
    tx: TransacaoComEscopo,
    papel: Papel,
    alvoId: string,
  ): Promise<Ocupante | null> {
    const vinculo = await tx.vinculoAtletica.findFirst({
      where: { papel, usuarioId: { not: alvoId } },
      select: { id: true, usuarioId: true, usuario: { select: { nome: true } } },
    })
    return (
      vinculo && { vinculoId: vinculo.id, usuarioId: vinculo.usuarioId, nome: vinculo.usuario.nome }
    )
  }

  private emitir(
    { id: autorId, atleticaId }: SolicitanteNaAtletica,
    usuarioId: string,
    papelAnterior: Papel,
    papelNovo: Papel,
  ): void {
    this.eventos.emitirAposCommit('usuario.papelAlterado', {
      atleticaId,
      usuarioId,
      papelAnterior,
      papelNovo,
      autorId,
    })
  }
}

function entradaCargo(
  usuarioId: string,
  antes: Papel,
  depois: Papel,
  contexto?: Record<string, unknown>,
): EntradaAuditoria {
  return {
    entidade: 'VinculoAtletica',
    acao: 'CARGO_ALTERADO',
    entidadeId: usuarioId,
    dados: { antes: { papel: antes }, depois: { papel: depois }, ...(contexto && { contexto }) },
  }
}
