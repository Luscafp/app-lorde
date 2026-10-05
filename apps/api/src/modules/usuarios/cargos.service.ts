import { nivelDoPapel, Papel, type AlterarPapel, type PapelAlterado } from '@atletica/shared'
import { Injectable } from '@nestjs/common'
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client'
import { TransacaoService } from '../../infra/eventos/apos-commit'
import { EventosDominioService } from '../../infra/eventos/eventos-dominio.service'
import type { TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { AuditoriaService, type EntradaAuditoria } from '../auditoria/auditoria.service'
import { diferenca } from '../auditoria/diferenca'
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

interface MudancaPapel {
  usuarioId: string
  papelAnterior: Papel
  papelNovo: Papel
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
    corpo: AlterarPapel,
    solicitante: SolicitanteNaAtletica,
  ): Promise<PapelAlterado> {
    try {
      return await this.transacao.executar((tx) => this.aplicar(tx, id, corpo, solicitante))
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
    { papel, confirmarSubstituicao = false }: AlterarPapel,
    solicitante: SolicitanteNaAtletica,
  ): Promise<PapelAlterado> {
    const { atleticaId } = solicitante
    await bloquearPapeis(tx, atleticaId)
    const alvo = await bloquearVinculo(tx, id, atleticaId)
    if (!alvo) throw erroUsuarioNaoEncontrado()
    if (alvo.excluido) throw erroUsuarioExcluido()

    const usuario = { id, papelAnterior: alvo.papel, papel }
    if (papel === alvo.papel) return { alterado: false, usuario, substituido: null }

    if (!alvo.ativo && nivelDoPapel(papel) > nivelDoPapel(Papel.ATLETA)) {
      throw erroUsuarioDesativado()
    }
    if (alvo.papel === Papel.ADMINISTRADOR) {
      await garantirNaoUltimoAdministrador(tx, atleticaId, id)
    }
    // Depois do RN08: no rebaixamento cruzado entre dois admins, o perdedor recebe 409, não 403.
    await papelDoSolicitante(tx, solicitante.id, Papel.ADMINISTRADOR)

    const ocupante = CARGOS_UNICOS.has(papel) ? await this.ocupante(tx, papel, id) : null
    if (ocupante && !confirmarSubstituicao) throw erroSubstituicaoNecessaria(ocupante.nome, papel)

    const promocao: MudancaPapel = { usuarioId: id, papelAnterior: alvo.papel, papelNovo: papel }
    const rebaixamento: MudancaPapel | null = ocupante && {
      usuarioId: ocupante.usuarioId,
      papelAnterior: papel,
      papelNovo: Papel.DIRETOR,
    }

    if (ocupante) {
      await tx.vinculoAtletica.update({
        where: { id: ocupante.vinculoId },
        data: { papel: Papel.DIRETOR },
      })
    }
    await tx.vinculoAtletica.update({ where: { id: alvo.id }, data: { papel } })
    await this.auditoria.registrarVarios(tx, [
      ...(rebaixamento ? [entradaCargo(rebaixamento, { substituidoPor: id })] : []),
      entradaCargo(promocao),
    ])

    if (rebaixamento) this.emitir(solicitante, rebaixamento)
    this.emitir(solicitante, promocao)

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

  private emitir({ id: autorId, atleticaId }: SolicitanteNaAtletica, mudanca: MudancaPapel): void {
    this.eventos.emitirAposCommit('usuario.papelAlterado', { atleticaId, autorId, ...mudanca })
  }
}

function entradaCargo(
  { usuarioId, papelAnterior, papelNovo }: MudancaPapel,
  contexto?: { substituidoPor: string },
): EntradaAuditoria {
  const { antes, depois } = diferenca({ papel: papelAnterior }, { papel: papelNovo }) ?? {
    antes: {},
    depois: {},
  }
  return {
    entidade: 'VinculoAtletica',
    acao: 'CARGO_ALTERADO',
    entidadeId: usuarioId,
    dados: { antes, depois, ...(contexto && { contexto }) },
  }
}
