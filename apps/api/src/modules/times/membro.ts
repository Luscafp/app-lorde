import type { Prisma } from '../../generated/prisma/client'
import type { UploadsService } from '../uploads/uploads.service'

export const ELENCO_ATUAL = { saidaEm: null } as const

export const CAMPOS_MEMBRO = {
  id: true,
  nome: true,
  fotoKey: true,
  excluidoEm: true,
} as const satisfies Prisma.UsuarioSelect

type LinhaMembro = Prisma.UsuarioGetPayload<{ select: typeof CAMPOS_MEMBRO }>

const NOME_USUARIO_EXCLUIDO = 'Usuário excluído'

/** Conta excluída aparece anonimizada (sem nome nem foto). */
export function identidadeMembro(usuario: LinhaMembro, uploads: UploadsService) {
  const excluido = usuario.excluidoEm !== null
  return {
    nome: excluido ? NOME_USUARIO_EXCLUIDO : usuario.nome,
    fotoUrl: excluido ? null : uploads.urlPublica(usuario.fotoKey),
  }
}
