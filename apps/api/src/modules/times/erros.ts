import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

const TIME_DUPLICADO = 'Já existe um time com este nome nesta modalidade.'
const TIME_COM_EVENTOS = 'Este time já tem eventos; a modalidade não pode ser trocada.'

export function erroTimeNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Time não encontrado.')
}

export function erroModalidadeNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Modalidade não encontrada.', [
    { field: 'modalidadeId', message: 'Modalidade não encontrada.' },
  ])
}

export function erroAdversariaNaoEncontrada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Atlética adversária não encontrada.', [
    { field: 'atleticaAdversariaId', message: 'Atlética adversária não encontrada.' },
  ])
}

export function erroModalidadeInativa(): ErroNegocio {
  const mensagem = 'Esta modalidade está inativa.'
  return new ErroNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'MODALIDADE_INATIVA', mensagem, [
    { field: 'modalidadeId', message: mensagem },
  ])
}

export function erroTimeDuplicado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'TIME_DUPLICADO', TIME_DUPLICADO, [
    { field: 'nome', message: TIME_DUPLICADO },
  ])
}

export function erroTimeComEventos(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'TIME_COM_EVENTOS', TIME_COM_EVENTOS, [
    { field: 'modalidadeId', message: TIME_COM_EVENTOS },
  ])
}

export function erroTimeComDependencias(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'TIME_COM_DEPENDENCIAS',
    'Este time tem eventos, membros ou solicitações. Desative-o em vez de excluir.',
  )
}
