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

export type Bloqueio = 'USUARIO_EXCLUIDO' | 'ALVO_PROPRIO' | 'NIVEL_INSUFICIENTE'

export const MENSAGEM_DE_BLOQUEIO: Readonly<Record<Bloqueio, string>> = {
  USUARIO_EXCLUIDO: MENSAGEM_USUARIO_EXCLUIDO,
  ALVO_PROPRIO: MENSAGEM_ALVO_PROPRIO,
  NIVEL_INSUFICIENTE: MENSAGEM_NIVEL_INSUFICIENTE,
}

const ERRO_DE_BLOQUEIO: Readonly<Record<Bloqueio, () => ErroNegocio>> = {
  USUARIO_EXCLUIDO: erroUsuarioExcluido,
  ALVO_PROPRIO: erroAlvoProprio,
  NIVEL_INSUFICIENTE: erroNivelInsuficiente,
}

export function erroDeBloqueio(bloqueio: Bloqueio): ErroNegocio {
  return ERRO_DE_BLOQUEIO[bloqueio]()
}

export function erroUltimoAdministrador(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'ULTIMO_ADMINISTRADOR',
    'A atlética precisa de ao menos um Administrador ativo.',
  )
}

export const MENSAGEM_SENHA_INCORRETA = 'Senha atual incorreta.'
export const MENSAGEM_SENHA_IGUAL_ATUAL = 'A nova senha deve ser diferente da atual.'

/** 400, e não 401: um 401 dispararia o refresh e o logout do app (issue #13 §7.5). */
export function erroSenhaIncorreta(): ErroNegocio {
  return new ErroNegocio(HttpStatus.BAD_REQUEST, 'SENHA_INCORRETA', MENSAGEM_SENHA_INCORRETA, [
    { field: 'senhaAtual', message: MENSAGEM_SENHA_INCORRETA },
  ])
}

export function erroSenhaIgualAtual(): ErroNegocio {
  return new ErroNegocio(HttpStatus.BAD_REQUEST, 'SENHA_IGUAL_ATUAL', MENSAGEM_SENHA_IGUAL_ATUAL, [
    { field: 'novaSenha', message: MENSAGEM_SENHA_IGUAL_ATUAL },
  ])
}
