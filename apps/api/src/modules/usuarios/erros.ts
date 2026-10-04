import { HttpStatus } from '@nestjs/common'
import { ErroNegocio } from '../../common/erros/erro-negocio'

export const MENSAGEM_NIVEL_INSUFICIENTE =
  'Só é possível alterar usuários de nível de acesso inferior ao seu.'
export const MENSAGEM_ALVO_PROPRIO = 'Você não pode desativar a própria conta.'
export const MENSAGEM_USUARIO_EXCLUIDO = 'Este usuário excluiu a conta.'

/** Inexistente e de outra atlética respondem igual (convenções §6). */
export function erroUsuarioNaoEncontrado(): ErroNegocio {
  return new ErroNegocio(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Usuário não encontrado.')
}

export function erroNivelInsuficiente(): ErroNegocio {
  return new ErroNegocio(HttpStatus.FORBIDDEN, 'NIVEL_INSUFICIENTE', MENSAGEM_NIVEL_INSUFICIENTE)
}

export function erroAlvoProprio(): ErroNegocio {
  return new ErroNegocio(HttpStatus.FORBIDDEN, 'ALVO_PROPRIO', MENSAGEM_ALVO_PROPRIO)
}

export function erroUsuarioExcluido(): ErroNegocio {
  return new ErroNegocio(HttpStatus.CONFLICT, 'USUARIO_EXCLUIDO', MENSAGEM_USUARIO_EXCLUIDO)
}

export function erroUltimoAdministrador(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'ULTIMO_ADMINISTRADOR',
    'A atlética precisa de ao menos um Administrador ativo.',
  )
}
