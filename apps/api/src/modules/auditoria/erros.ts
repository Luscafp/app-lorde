/** Uso incorreto do `AuditoriaService`. Bug de programação: vira 500. */
export class ErroAuditoria extends Error {
  override readonly name = 'ErroAuditoria'
}
