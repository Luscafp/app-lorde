import { Prisma } from '../../generated/prisma/client'

/** Tentativa de alterar ou apagar auditoria. Bug de programação: vira 500. */
export class ErroAuditoriaImutavel extends Error {
  override readonly name = 'ErroAuditoriaImutavel'

  constructor(readonly operacao: string) {
    super(`RegistroAuditoria é imutável: ${operacao} não é permitido.`)
  }
}

const OPERACOES_PROIBIDAS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
])

/** Rejeita alteração e exclusão de `RegistroAuditoria`; o trigger da migration cobre o SQL cru. */
export const extensaoAuditoriaImutavel = Prisma.defineExtension({
  name: 'auditoria-imutavel',
  query: {
    registroAuditoria: {
      async $allOperations({ operation, args, query }) {
        if (OPERACOES_PROIBIDAS.has(operation)) throw new ErroAuditoriaImutavel(operation)
        return query(args)
      },
    },
  },
})
