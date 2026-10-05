import { HttpStatus } from '@nestjs/common'
import type { StatusEvento } from '@atletica/shared'
import { ErroNegocio, type DetalheErro } from '../../common/erros/erro-negocio'

function erroDeCampo(status: number, code: string, field: string, message: string): ErroNegocio {
  return new ErroNegocio(status, code, message, [{ field, message }])
}

export function erroEventoNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Evento não encontrado.')
}

/** Time inexistente ou de outra atlética, sem revelar qual (convenções §6). */
export function erroTimeInvalido(): ErroNegocio {
  const mensagem = 'Selecione um time da atlética.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INVALIDO', 'timeId', mensagem)
}

export function erroTimeInativo(): ErroNegocio {
  const mensagem = 'Este time está inativo.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'TIME_INATIVO', 'timeId', mensagem)
}

export function erroModalidadeInativa(): ErroNegocio {
  const mensagem = 'A modalidade deste time está inativa.'
  return erroDeCampo(HttpStatus.UNPROCESSABLE_ENTITY, 'MODALIDADE_INATIVA', 'timeId', mensagem)
}

export function erroAdversarioInvalido(): ErroNegocio {
  const mensagem = 'Selecione um time ativo de outra atlética.'
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'ADVERSARIO_INVALIDO',
    'timeAdversarioId',
    mensagem,
  )
}

export function erroModalidadesDiferentes(): ErroNegocio {
  const mensagem = 'O adversário deve ser da mesma modalidade do time.'
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'MODALIDADES_DIFERENTES',
    'timeAdversarioId',
    mensagem,
  )
}

export function erroAdversarioEmTreino(): ErroNegocio {
  const mensagem = 'Treino não tem adversário.'
  return erroDeCampo(HttpStatus.BAD_REQUEST, 'VALIDATION_ERROR', 'timeAdversarioId', mensagem)
}

export function erroEventoCancelado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_CANCELADO',
    'Evento cancelado não pode ser editado.',
  )
}

export function erroEventoFinalizado(mensagem: string): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'EVENTO_FINALIZADO', mensagem)
}

export function erroEventoJaCancelado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'EVENTO_JA_CANCELADO',
    'Este evento já está cancelado.',
  )
}

/** Cancelamento a partir de um status que não o permite. */
export function erroCancelamento(status: StatusEvento): ErroNegocio {
  return status === 'FINALIZADO'
    ? erroEventoFinalizado('Evento finalizado não pode ser cancelado.')
    : erroEventoJaCancelado()
}

export function erroEventoComParticipacoes(): ErroNegocio {
  const mensagem = 'O evento já tem respostas do elenco; o time não pode ser trocado.'
  return erroDeCampo(HttpStatus.CONFLICT, 'EVENTO_COM_PARTICIPACOES', 'timeId', mensagem)
}

export function erroEventoComDependencias(details: DetalheErro[]): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'EVENTO_COM_DEPENDENCIAS',
    'Este evento tem respostas, presenças ou resultado. Cancele-o em vez de excluir.',
    details,
  )
}
