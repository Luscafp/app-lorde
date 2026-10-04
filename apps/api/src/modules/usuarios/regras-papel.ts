import { ehAdministrador, Papel, podeAgirSobre, type PermissoesUsuario } from '@atletica/shared'
import type { ClienteComEscopo, TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import { erroUltimoAdministrador, MENSAGEM_DE_BLOQUEIO, type Bloqueio } from './erros'

type ClienteVinculos = Pick<ClienteComEscopo, 'vinculoAtletica'>

export interface Solicitante {
  id: string
  papel: Papel
}

export interface AlvoPermissoes {
  id: string
  papel: Papel
  excluido: boolean
}

/** Serializa as alterações de papel e situação da atlética (#12, #27, #28); dura até o commit. */
export async function bloquearPapeis(tx: TransacaoComEscopo, atleticaId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`papeis:${atleticaId}`}))`
}

/** `true` se nenhum outro vínculo `ADMINISTRADOR` ativo, de conta não excluída, existe na atlética. */
export async function ehUltimoAdministrador(
  cliente: ClienteVinculos,
  atleticaId: string,
  usuarioId: string,
): Promise<boolean> {
  const outros = await cliente.vinculoAtletica.count({
    where: {
      atleticaId,
      papel: Papel.ADMINISTRADOR,
      ativo: true,
      usuarioId: { not: usuarioId },
      usuario: { excluidoEm: null },
    },
  })
  return outros === 0
}

/** Chame depois de `bloquearPapeis`, na mesma transação. */
export async function garantirNaoUltimoAdministrador(
  tx: TransacaoComEscopo,
  atleticaId: string,
  usuarioId: string,
): Promise<void> {
  if (await ehUltimoAdministrador(tx, atleticaId, usuarioId)) throw erroUltimoAdministrador()
}

/** Ordem única das checagens de desativar/reativar: leitura (`permissoes`) e escrita. */
export function bloqueioDaAcao(solicitante: Solicitante, alvo: AlvoPermissoes): Bloqueio | null {
  if (alvo.excluido) return 'USUARIO_EXCLUIDO'
  if (alvo.id === solicitante.id) return 'ALVO_PROPRIO'
  if (!podeAgirSobre(solicitante.papel, alvo.papel)) return 'NIVEL_INSUFICIENTE'
  return null
}

/** `ehUltimoAdmin`: o alvo é Administrador ativo e não há outro (ver `ehUltimoAdministrador`). */
export function calcularPermissoes(
  solicitante: Solicitante,
  alvo: AlvoPermissoes,
  ehUltimoAdmin: boolean,
): PermissoesUsuario {
  const bloqueio = bloqueioDaAcao(solicitante, alvo)
  return {
    podeAlterarSituacao: bloqueio === null,
    motivoBloqueio: bloqueio && MENSAGEM_DE_BLOQUEIO[bloqueio],
    podeAlterarPapel:
      ehAdministrador(solicitante.papel) && !alvo.excluido && alvo.id !== solicitante.id,
    ehUltimoAdministrador: ehUltimoAdmin && !alvo.excluido,
  }
}
