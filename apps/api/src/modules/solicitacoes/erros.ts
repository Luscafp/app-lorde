import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

export function erroSolicitacaoNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Solicitação não encontrada.')
}

export function erroTimeAdversarioSemSolicitacao(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'TIME_ADVERSARIO',
    'Times adversários não recebem solicitações de entrada.',
  )
}

export function erroTimeInativo(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'TIME_INATIVO',
    'Este time está inativo e não recebe solicitações.',
  )
}

export function erroJaEMembro(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'JA_E_MEMBRO', 'Você já faz parte deste time.')
}

export function erroSolicitacaoPendente(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'SOLICITACAO_PENDENTE',
    'Você já tem uma solicitação pendente para este time.',
  )
}

export function erroSolicitacaoCancelada(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'SOLICITACAO_CANCELADA',
    'O atleta cancelou esta solicitação.',
  )
}

export function erroSolicitacaoJaAvaliada(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'SOLICITACAO_JA_AVALIADA',
    'Esta solicitação já foi avaliada pela diretoria.',
  )
}
