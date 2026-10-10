import { HttpStatus } from '@nestjs/common'
import { ErroNegocio, erroDeCampo } from '../../../common/erros/erro-negocio'

/** Time adversário (sem elenco, RN21) ou inativo. */
export function erroTimeInvalidoAviso(): ErroNegocio {
  const mensagem = 'Selecione um time ativo da atlética.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INVALIDO_AVISO', 'timeId', mensagem)
}
