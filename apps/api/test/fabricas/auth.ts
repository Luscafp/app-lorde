import { randomBytes } from 'node:crypto'
import type { Prisma, Sessao, Usuario } from '../../src/generated/prisma/client'
import { prismaTeste } from '../setup/prisma-teste'
import { assinarToken } from './token'

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000

type UsuarioDoToken = Pick<Usuario, 'id'> & { atleticaId?: string }

export interface OpcoesToken {
  /** Atlética do token (`atl`); padrão: a do usuário criado por `criarUsuario`. */
  atleticaId?: string
  /** Sessão já criada (ex.: para revogá-la depois); sem ela, cria uma nova. */
  sessao?: Pick<Sessao, 'id'>
}

/** Cria uma `Sessao` ativa (30 dias) com refresh token fictício. */
export function criarSessao(
  dados: Pick<Prisma.SessaoUncheckedCreateInput, 'usuarioId' | 'atleticaId'> &
    Partial<Prisma.SessaoUncheckedCreateInput>,
): Promise<Sessao> {
  return prismaTeste.sessao.create({
    data: {
      refreshTokenHash: randomBytes(32).toString('hex'),
      expiraEm: new Date(Date.now() + TRINTA_DIAS_MS),
      ...dados,
    },
  })
}

/** Access token válido para o usuário, com sessão no banco (convenções §9). */
export async function tokenPara(
  usuario: UsuarioDoToken,
  opcoes: OpcoesToken = {},
): Promise<string> {
  const atleticaId = opcoes.atleticaId ?? usuario.atleticaId
  if (!atleticaId) throw new Error('tokenPara: informe a atlética do token')
  const sessao = opcoes.sessao ?? (await criarSessao({ usuarioId: usuario.id, atleticaId }))
  return assinarToken({ sub: usuario.id, atl: atleticaId, sid: sessao.id })
}
