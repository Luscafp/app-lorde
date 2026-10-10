import { HttpStatus } from '@nestjs/common'
import { ErroNegocio, erroDeCampo } from '../../../common/erros/erro-negocio'

/** Inexistente e de outra atlética respondem igual (convenções §6). */
export function erroTimeNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Time não encontrado.')
}

/** Time adversário (sem elenco, RN21) ou inativo. */
export function erroTimeInvalidoAviso(): ErroNegocio {
  const mensagem = 'Selecione um time ativo da atlética.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INVALIDO_AVISO', 'timeId', mensagem)
}
