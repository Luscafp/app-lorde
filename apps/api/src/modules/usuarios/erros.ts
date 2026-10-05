import { ROTULO_PAPEL, type Papel } from '@atletica/shared'
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
    'É preciso haver ao menos um Administrador ativo.',
  )
}

export function erroSubstituicaoNecessaria(ocupante: string, cargo: Papel): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'SUBSTITUICAO_NECESSARIA',
    `${ocupante} é o atual ${ROTULO_PAPEL[cargo]} e passará a Diretor.`,
    [{ field: 'confirmarSubstituicao', message: 'Confirme a substituição para continuar.' }],
  )
}

export function erroUsuarioDesativado(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'USUARIO_DESATIVADO',
    'Reative a conta antes de promover este usuário.',
  )
}

export function erroConflitoConcorrente(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'CONFLITO_CONCORRENTE',
    'Outro cargo foi alterado ao mesmo tempo. Tente novamente.',
  )
}
