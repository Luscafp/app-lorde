import { MotivoBloqueioResposta } from '@atletica/shared'
import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

const MENSAGENS: Record<MotivoBloqueioResposta, string> = {
  NAO_MEMBRO_DO_ELENCO: 'Apenas membros do elenco podem confirmar participação.',
  EVENTO_CANCELADO: 'Este evento foi cancelado.',
  EVENTO_NAO_AGENDADO: 'Não é mais possível responder: o evento já começou ou foi finalizado.',
  EVENTO_JA_INICIADO: 'O evento já começou; não é possível alterar a resposta.',
}

/** Recusa por vínculo com o time é 403 com `code` próprio; as demais, 422 (#24 §7). */
export function erroRespostaBloqueada(motivo: MotivoBloqueioResposta): ErroNegocio {
  const status =
    motivo === MotivoBloqueioResposta.NAO_MEMBRO_DO_ELENCO
      ? HttpStatus.FORBIDDEN
      : HttpStatus.UNPROCESSABLE_ENTITY
  return new ErroNegocio(status, motivo, MENSAGENS[motivo])
}

export function erroStatusSemPresenca(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_STATUS_INVALIDO',
    'A presença só pode ser registrada em eventos em andamento ou finalizados.',
  )
}

/** Um `details` por id fora do elenco do evento, inclusive de outra atlética. */
export function erroAtletaForaDoElenco(usuarioIds: string[]): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'ATLETA_FORA_DO_ELENCO',
    'Há atletas que não estavam no elenco do time no início do evento.',
    usuarioIds.map((id) => ({ field: 'presentes', message: id })),
  )
}
