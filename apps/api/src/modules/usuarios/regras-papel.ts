import { ehAdministrador, Papel, podeAgirSobre, type PermissoesUsuario } from '@atletica/shared'
import type { ClienteComEscopo, TransacaoComEscopo } from '../../infra/prisma/prisma.service'
import {
  erroUltimoAdministrador,
  MENSAGEM_ALVO_PROPRIO,
  MENSAGEM_NIVEL_INSUFICIENTE,
  MENSAGEM_USUARIO_EXCLUIDO,
} from './erros'

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

function motivoBloqueio(solicitante: Solicitante, alvo: AlvoPermissoes): string | null {
  if (alvo.excluido) return MENSAGEM_USUARIO_EXCLUIDO
  if (alvo.id === solicitante.id) return MENSAGEM_ALVO_PROPRIO
  if (!podeAgirSobre(solicitante.papel, alvo.papel)) return MENSAGEM_NIVEL_INSUFICIENTE
  return null
}

/** `ehUltimoAdmin`: o alvo é Administrador ativo e não há outro (ver `ehUltimoAdministrador`). */
export function calcularPermissoes(
  solicitante: Solicitante,
  alvo: AlvoPermissoes,
  ehUltimoAdmin: boolean,
): PermissoesUsuario {
  const motivo = motivoBloqueio(solicitante, alvo)
  return {
    podeAlterarSituacao: motivo === null,
    motivoBloqueio: motivo,
    podeAlterarPapel:
      ehAdministrador(solicitante.papel) && !alvo.excluido && alvo.id !== solicitante.id,
    ehUltimoAdministrador: ehUltimoAdmin && !alvo.excluido,
  }
}
