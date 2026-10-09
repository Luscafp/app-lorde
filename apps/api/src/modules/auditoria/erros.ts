import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

/** Uso incorreto do `AuditoriaService`. Bug de programação: vira 500. */
export class ErroAuditoria extends Error {
  override readonly name = 'ErroAuditoria'
}

export function erroRegistroNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Registro de auditoria não encontrado.')
}
