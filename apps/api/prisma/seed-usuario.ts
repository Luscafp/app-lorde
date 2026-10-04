import type { Papel } from '../src/generated/prisma/client'
import type { TransacaoComEscopo } from '../src/infra/prisma/prisma.service'

export interface UsuarioSeed {
  email: string
  nome: string
  papel: Papel
}

/** Cria usuário (e-mail verificado, preferências padrão) e vínculo se faltarem; nunca os altera. */
export async function garantirUsuarioComVinculo(
  tx: TransacaoComEscopo,
  atleticaId: string,
  { email, nome, papel }: UsuarioSeed,
  senhaHash: string,
): Promise<string> {
  const usuario = await tx.usuario.upsert({
    where: { email },
    create: { email, nome, senhaHash, emailVerificado: true, preferencia: { create: {} } },
    update: {},
  })
  await tx.vinculoAtletica.upsert({
    where: { usuarioId_atleticaId: { usuarioId: usuario.id, atleticaId } },
    create: { usuarioId: usuario.id, atleticaId, papel },
    update: {},
  })
  return usuario.id
}
