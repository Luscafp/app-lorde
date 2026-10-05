import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

const MODALIDADE_DUPLICADA = 'Já existe uma modalidade com este nome.'

export function erroModalidadeDuplicada(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'MODALIDADE_DUPLICADA', MODALIDADE_DUPLICADA, [
    { field: 'nome', message: MODALIDADE_DUPLICADA },
  ])
}

export function erroModalidadeComDependencias(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'MODALIDADE_COM_DEPENDENCIAS',
    'Esta modalidade tem times vinculados. Desative-a em vez de excluir.',
  )
}

const MODALIDADE_NAO_ENCONTRADA = 'Modalidade não encontrada.'

/** `campo`: a modalidade veio no corpo de outro recurso (ex.: `modalidadeId` do time). */
export function erroModalidadeNaoEncontrada(campo?: string): ErroNegocio {
  const details = campo ? [{ field: campo, message: MODALIDADE_NAO_ENCONTRADA }] : undefined
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', MODALIDADE_NAO_ENCONTRADA, details)
}
