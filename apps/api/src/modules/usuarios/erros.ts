import { ROTULO_PAPEL, type Papel } from '@atletica/shared'
import { HttpStatus } from '@nestjs/common'
import { erroDeCampo, ErroNegocio } from '../../common/erros/erro-negocio'

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

export function erroUltimoAdministradorExclusao(): ErroNegocio {
  return new ErroNegocio(
    HttpStatus.CONFLICT,
    'ULTIMO_ADMINISTRADOR',
    'Você é o único Administrador. Conceda o cargo a outra pessoa antes de excluir sua conta.',
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

const SENHA_IGUAL_ATUAL = 'A nova senha deve ser diferente da atual.'

/** Campo do corpo que leva a senha conferida: troca de senha (#13) ou exclusão de conta (#12). */
export type CampoSenha = 'senhaAtual' | 'senha'

const SENHA_INCORRETA: Readonly<Record<CampoSenha, string>> = {
  senhaAtual: 'Senha atual incorreta.',
  senha: 'Senha incorreta.',
}

/** 400, e não 401: um 401 dispararia o refresh e o logout do app (issue #13 §7.5). */
export function erroSenhaIncorreta(campo: CampoSenha): ErroNegocio {
  return erroDeCampo(HttpStatus.BAD_REQUEST, 'SENHA_INCORRETA', campo, SENHA_INCORRETA[campo])
}

export function erroSenhaIgualAtual(): ErroNegocio {
  return new ErroNegocio(HttpStatus.BAD_REQUEST, 'SENHA_IGUAL_ATUAL', SENHA_IGUAL_ATUAL, [
    { field: 'novaSenha', message: SENHA_IGUAL_ATUAL },
  ])
}
