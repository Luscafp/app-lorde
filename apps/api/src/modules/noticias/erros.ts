import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

/** Inexistente, rascunho, excluída e de outra atlética respondem igual (RN24, convenções §6). */
export function erroNoticiaNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Notícia não encontrada.')
}
