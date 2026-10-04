/** Tentativa de alterar ou apagar auditoria. Bug de programação: vira 500. */
export class ErroAuditoriaImutavel extends Error {
  override readonly name = 'ErroAuditoriaImutavel'

  constructor(readonly operacao: string) {
    super(`RegistroAuditoria é imutável: ${operacao} não é permitido.`)
  }
}
