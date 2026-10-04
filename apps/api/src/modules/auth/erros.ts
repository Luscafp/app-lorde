import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

export function erroNaoAutenticado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'UNAUTHENTICATED',
    'Sessão inválida. Entre novamente.',
  )
}

export function erroTokenExpirado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.UNAUTHORIZED, 'TOKEN_EXPIRED', 'Sessão expirada.')
}

export function erroContaDesativada(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.UNAUTHORIZED,
    'CONTA_DESATIVADA',
    'Sua conta está desativada. Procure a diretoria.',
  )
}

export function erroSemPermissao(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.FORBIDDEN,
    'FORBIDDEN',
    'Você não tem permissão para esta ação.',
  )
}
