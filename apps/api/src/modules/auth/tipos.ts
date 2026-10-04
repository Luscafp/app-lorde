import type { NivelPapel, Papel } from '@atletica/shared'
import type { Request } from 'express'
import type { z } from 'zod'
import type { payloadAcessoSchema } from './token.config'

export type PayloadAcesso = z.infer<typeof payloadAcessoSchema>

/** Usuário da requisição, montado pelo `JwtAuthGuard` com o papel lido do banco. */
export interface UsuarioAutenticado {
  id: string
  nome: string
  email: string
  atleticaId: string
  sessaoId: string
  papel: Papel
  nivel: NivelPapel
}

export interface RequisicaoAutenticada extends Request {
  usuario?: UsuarioAutenticado
}
