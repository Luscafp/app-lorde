import { HttpStatus } from '@nestjs/common'
import { ErroNegocio, erroDeCampo } from '../../common/erros/erro-negocio'

const TIME_DUPLICADO = 'Já existe um time com este nome nesta modalidade.'
const TIME_COM_EVENTOS = 'Este time já tem eventos; a modalidade não pode ser trocada.'

export function erroTimeNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Time não encontrado.')
}

export function erroModalidadeInativa(): ErroNegocio {
  const mensagem = 'Esta modalidade está inativa.'
  return erroDeCampo(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'MODALIDADE_INATIVA',
    'modalidadeId',
    mensagem,
  )
}

export function erroTimeDuplicado(): ErroNegocio {
  return erroDeCampo(HttpStatus.CONFLICT, 'TIME_DUPLICADO', 'nome', TIME_DUPLICADO)
}

export function erroTimeComEventos(): ErroNegocio {
  return erroDeCampo(HttpStatus.CONFLICT, 'TIME_COM_EVENTOS', 'modalidadeId', TIME_COM_EVENTOS)
}

export function erroTimeAdversario(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'TIME_ADVERSARIO',
    'Times adversários não têm elenco nem capitão.',
  )
}

export function erroMembroNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.NOT_FOUND,
    'MEMBRO_NAO_ENCONTRADO',
    'Este usuário não faz parte do elenco do time.',
  )
}

export function erroNaoEMembro(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'NAO_E_MEMBRO', 'Você não faz parte deste time.')
}

export function erroCapitaoForaDoElenco(): ErroNegocio {
  const mensagem = 'O capitão precisa ser membro do elenco atual.'
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'CAPITAO_FORA_DO_ELENCO', mensagem, [
    { field: 'usuarioId', message: mensagem },
  ])
}

export function erroTimeComDependencias(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'TIME_COM_DEPENDENCIAS',
    'Este time tem eventos, membros ou solicitações. Desative-o em vez de excluir.',
  )
}
